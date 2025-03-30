import emittery from 'emittery'
import {glob} from 'fast-glob'
import * as fs from 'fs'
import * as path from 'path'
import * as errorCause from 'pony-cause'
import {pathToFileURL} from 'url'
import type {CommandLineParserOptions} from './cli'
import {UmzugCLI} from './cli'
import type {UmzugStorage} from './storage'
import {JSONStorage, verifyUmzugStorage} from './storage'
import * as templates from './templates'

import type {
  InputMigrations,
  MigrateDownOptions,
  MigrateUpOptions,
  MigrationMeta,
  MigrationParams,
  Resolver,
  RunnableMigration,
  UmzugEvents,
  UmzugOptions,
} from './types'
import {RerunBehavior} from './types'

type MigrationErrorParams = {
  direction: 'up' | 'down'
} & MigrationParams<unknown>

export class MigrationError extends errorCause.ErrorWithCause<unknown> {
  name = 'MigrationError'
  migration: MigrationErrorParams
  // TODO [>=4.0.0] Remove this backwards-compatibility with verror
  jse_cause: unknown

  // TODO [>=4.0.0] Take a `{ cause: ... }` options bag like the default `Error`, it looks like this because of verror backwards-compatibility.
  constructor(migration: MigrationErrorParams, original: unknown) {
    super(`Migration ${migration.name} (${migration.direction}) failed: ${MigrationError.errorString(original)}`, {
      cause: original,
    })
    this.jse_cause = original
    this.migration = migration
  }

  // TODO [>=4.0.0] Remove this backwards-compatibility alias
  get info() {
    return this.migration
  }

  private static errorString(cause: unknown) {
    return cause instanceof Error
      ? `Original error: ${cause.message}`
      : `Non-error value thrown. See info for full props: ${cause as string}`
  }
}

export class Umzug<Ctx extends object = object> extends emittery<UmzugEvents<Ctx>> {
  private readonly storage: UmzugStorage<Ctx>
  readonly migrations: (ctx: Ctx) => Promise<ReadonlyArray<RunnableMigration<Ctx>>>

  /**
   * Compile-time only property for type inference. After creating an Umzug instance, it can be used as type alias for
   * a user-defined migration. The function receives a migration name, path and the context for an umzug instance
   * @example
   * ```
   * // migrator.ts
   * import { Umzug } from 'umzug'
   *
   * const umzug = new Umzug({...})
   * export type Migration = typeof umzug._types.migration;
   *
   * umzug.up();
   * ```
   * ___
   *
   * ```
   * // migration-1.ts
   * import type { Migration } from '../migrator'
   *
   * // name and context will now be strongly-typed
   * export const up: Migration = ({name, context}) => context.query(...)
   * export const down: Migration = ({name, context}) => context.query(...)
   * ```
   */
  declare readonly _types: {
    migration: (params: MigrationParams<Ctx>) => Promise<unknown>
    context: Ctx
  }

  /** creates a new Umzug instance */
  constructor(readonly options: UmzugOptions<Ctx>) {
    super()

    this.storage = verifyUmzugStorage(options.storage ?? new JSONStorage())
    this.migrations = this.getMigrationsResolver(this.options.migrations)
  }

  private logging(message: Record<string, unknown>) {
    this.options.logger?.info(message)
  }

  static defaultResolver: Resolver<unknown> = ({name, path: filepath}) => {
    if (!filepath) {
      throw new Error(`Can't use default resolver for non-filesystem migrations`)
    }

    const ext = path.extname(filepath)
    const languageSpecificHelp: Record<string, string> = {
      '.ts':
        "TypeScript files can be required by adding `ts-node` as a dependency and calling `require('ts-node/register')` at the program entrypoint before running migrations.",
      '.sql': 'Try writing a resolver which reads file content and executes it as a sql query.',
    }
    languageSpecificHelp['.cts'] = languageSpecificHelp['.ts']
    languageSpecificHelp['.mts'] = languageSpecificHelp['.ts']

    let loadModule: () => Promise<RunnableMigration<unknown>>

    const jsExt = ext.replace(/\.([cm]?)ts$/, '.$1js')

    const getModule = async () => {
      try {
        return await loadModule()
      } catch (e: unknown) {
        if ((e instanceof SyntaxError || e instanceof MissingResolverError) && ext in languageSpecificHelp) {
          e.message += '\n\n' + languageSpecificHelp[ext]
        }

        throw e
      }
    }

    if ((jsExt === '.js' && typeof require.main === 'object') || jsExt === '.cjs') {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      loadModule = async () => require(filepath) as RunnableMigration<unknown>
    } else if (jsExt === '.js' || jsExt === '.mjs') {
      const fileUrl = pathToFileURL(filepath).href
      loadModule = async () => import(fileUrl) as Promise<RunnableMigration<unknown>>
    } else {
      loadModule = async () => {
        throw new MissingResolverError(filepath)
      }
    }

    return {
      name,
      path: filepath,
      up: async ({context}) => (await getModule()).up({path: filepath, name, context}),
      down: async ({context}) => (await getModule()).down?.({path: filepath, name, context}),
    }
  }

  /**
   * Get an UmzugCLI instance. This can be overriden in a subclass to add/remove commands - only use if you really know you need this,
   * and are OK to learn about/interact with the API of @rushstack/ts-command-line.
   */
  protected getCli(options?: CommandLineParserOptions): UmzugCLI {
    return new UmzugCLI(this, options)
  }

  /**
   * 'Run' an umzug instance as a CLI. This will read `process.argv`, execute commands based on that, and call
   * `process.exit` after running. If that isn't what you want, stick to the programmatic API.
   * You probably want to run only if a file is executed as the process's 'main' module with something like:
   * @example
   * if (require.main === module) {
   *   myUmzugInstance.runAsCLI()
   * }
   */
  async runAsCLI(argv?: string[]): Promise<boolean> {
    const cli = this.getCli()
    return cli.execute(argv)
  }

  /** Get the list of migrations which have already been applied */
  async executed(): Promise<MigrationMeta[]> {
    return this.runCommand('executed', async ({context}) => {
      const list = await this._executed(context)
      // We do the following to not expose the `up` and `down` functions to the user
      return list.map(m => ({name: m.name, path: m.path}))
    })
  }

  /** Get the list of migrations which have already been applied */
  private async _executed(context: Ctx): Promise<ReadonlyArray<RunnableMigration<Ctx>>> {
    const [migrations, executedNames] = await Promise.all([this.migrations(context), this.storage.executed({context})])
    const executedSet = new Set(executedNames)
    return migrations.filter(m => executedSet.has(m.name))
  }

  /** Get the list of migrations which are yet to be applied */
  async pending(): Promise<MigrationMeta[]> {
    return this.runCommand('pending', async ({context}) => {
      const list = await this._pending(context)
      // We do the following to not expose the `up` and `down` functions to the user
      return list.map(m => ({name: m.name, path: m.path}))
    })
  }

  private async _pending(context: Ctx): Promise<Array<RunnableMigration<Ctx>>> {
    const [migrations, executedNames] = await Promise.all([this.migrations(context), this.storage.executed({context})])
    const executedSet = new Set(executedNames)
    return migrations.filter(m => !executedSet.has(m.name))
  }

  protected async runCommand<T>(command: string, cb: (commandParams: {context: Ctx}) => Promise<T>): Promise<T> {
    const context = await this.getContext()

    await this.emit('beforeCommand', {command, context})
    try {
      return await cb({context})
    } finally {
      await this.emit('afterCommand', {command, context})
    }
  }

  /**
   * Apply migrations. By default, runs all pending migrations.
   * @see MigrateUpOptions for other use cases using `to`, `migrations` and `rerun`.
   */
  async up(options: MigrateUpOptions = {}): Promise<MigrationMeta[]> {
    const eligibleMigrations = async (context: Ctx) => {
      if (options.migrations && options.rerun === RerunBehavior.ALLOW) {
        // Allow rerun means the specified migrations should be run even if they've run before - so get all migrations, not just pending
        const list = await this.migrations(context)
        return this.findMigrations(list, options.migrations)
      }

      if (options.migrations && options.rerun === RerunBehavior.SKIP) {
        const executedNames = new Set((await this._executed(context)).map(m => m.name))
        const filteredMigrations = options.migrations.filter(m => !executedNames.has(m))
        return this.findMigrations(await this.migrations(context), filteredMigrations)
      }

      if (options.migrations) {
        return this.findMigrations(await this._pending(context), options.migrations)
      }

      const allPending = await this._pending(context)

      let sliceIndex = options.step ?? allPending.length
      if (options.to) {
        sliceIndex = this.findNameIndex(allPending, options.to) + 1
      }

      return allPending.slice(0, sliceIndex)
    }

    return this.runCommand('up', async ({context}) => {
      const toBeApplied = await eligibleMigrations(context)

      for (const m of toBeApplied) {
        const start = Date.now()
        const params: MigrationParams<Ctx> = {name: m.name, path: m.path, context}

        this.logging({event: 'migrating', name: m.name})
        await this.emit('migrating', params)

        try {
          await m.up(params)
        } catch (e: unknown) {
          throw new MigrationError({direction: 'up', ...params}, e)
        }

        if (options.rerun !== RerunBehavior.ALLOW) {
            await this.storage.logMigration(params);
        }

        const duration = (Date.now() - start) / 1000
        this.logging({event: 'migrated', name: m.name, durationSeconds: duration})
        await this.emit('migrated', params)
      }

      return toBeApplied.map(m => ({name: m.name, path: m.path}))
    })
  }

  /**
   * Revert migrations. By default, the last executed migration is reverted.
   * @see MigrateDownOptions for other use cases using `to`, `migrations` and `rerun`.
   */
  async down(options: MigrateDownOptions = {}): Promise<MigrationMeta[]> {
    const eligibleMigrations = async (context: Ctx) => {
      if (options.migrations && options.rerun === RerunBehavior.ALLOW) {
        const list = await this.migrations(context)
        return this.findMigrations(list, options.migrations)
      }

      if (options.migrations && options.rerun === RerunBehavior.SKIP) {
        const pendingNames = new Set((await this._pending(context)).map(m => m.name))
        const filteredMigrations = options.migrations.filter(m => !pendingNames.has(m))
        return this.findMigrations(await this.migrations(context), filteredMigrations)
      }

      if (options.migrations) {
        return this.findMigrations(await this._executed(context), options.migrations)
      }

      const executedReversed = (await this._executed(context)).slice().reverse()

      let sliceIndex = options.step ?? 1
      if (options.to === 0 || options.migrations) {
        sliceIndex = executedReversed.length
      } else if (options.to) {
        sliceIndex = this.findNameIndex(executedReversed, options.to) + 1
      }

      return executedReversed.slice(0, sliceIndex)
    }

    return this.runCommand('down', async ({context}) => {
      const toBeReverted = await eligibleMigrations(context)

      for (const m of toBeReverted) {
        const start = Date.now()
        const params: MigrationParams<Ctx> = {name: m.name, path: m.path, context}

        this.logging({event: 'reverting', name: m.name})
        await this.emit('reverting', params)

        try {
          await m.down?.(params)
        } catch (e: unknown) {
          throw new MigrationError({direction: 'down', ...params}, e)
        }

        await this.storage.unlogMigration(params)

        const duration = Number.parseFloat(((Date.now() - start) / 1000).toFixed(3))
        this.logging({event: 'reverted', name: m.name, durationSeconds: duration})
        await this.emit('reverted', params)
      }

      return toBeReverted.map(m => ({name: m.name, path: m.path}))
    })
  }

  async create(options: {
    name: string
    folder?: string
    prefix?: 'TIMESTAMP' | 'DATE' | 'NONE'
    allowExtension?: string
    allowConfusingOrdering?: boolean
    skipVerify?: boolean
    /** Optionally define the content for the new file. If not set, the configured template will be used. */
    content?: string
  }): Promise<void> {
    await this.runCommand('create', async ({context}) => {
      const isoDate = new Date().toISOString()
      const prefixes = {
        TIMESTAMP: isoDate.replace(/\.\d{3}Z$/, '').replace(/\W/g, '.'),
        DATE: isoDate.split('T')[0].replace(/\W/g, '.'),
        NONE: '',
      }
      const prefixType = options.prefix ?? 'TIMESTAMP'
      const fileBasename = [prefixes[prefixType], options.name].filter(Boolean).join('.')

      const allowedExtensions = options.allowExtension
        ? [options.allowExtension]
        : ['.js', '.cjs', '.mjs', '.ts', '.cts', '.mts', '.sql']

      const existing = await this.migrations(context)
      const last = existing.slice(-1)[0]

      const folder = options.folder || this.options.create?.folder || (last?.path && path.dirname(last.path))

      if (!folder) {
        throw new Error(`Couldn't infer a directory to generate migration file in. Pass folder explicitly`)
      }

      const filepath = path.join(folder, fileBasename)

      if (!options.allowConfusingOrdering) {
        const confusinglyOrdered = existing.find(e => e.path && e.path >= filepath)
        if (confusinglyOrdered) {
          throw new Error(
            `Can't create ${fileBasename}, since it's unclear if it should run before or after existing migration ${confusinglyOrdered.name}. Use allowConfusingOrdering to bypass this error.`,
          )
        }
      }

      const template =
        typeof options.content === 'string'
          ? async () => [[filepath, options.content] as [string, string]]
          : // eslint-disable-next-line @typescript-eslint/unbound-method
            this.options.create?.template ?? Umzug.defaultCreationTemplate

      const toWrite = await template(filepath)
      if (toWrite.length === 0) {
        toWrite.push([filepath, ''])
      }

      toWrite.forEach(pair => {
        if (!Array.isArray(pair) || pair.length !== 2) {
          throw new Error(
            `Expected [filepath, content] pair. Check that the file template function returns an array of pairs.`,
          )
        }

        const ext = path.extname(pair[0])
        if (!allowedExtensions.includes(ext)) {
          const allowStr = allowedExtensions.join(', ')
          const message = `Extension ${ext} not allowed. Allowed extensions are ${allowStr}. See help for allowExtension to avoid this error.`
          throw new Error(message)
        }

        fs.mkdirSync(path.dirname(pair[0]), {recursive: true})
        fs.writeFileSync(pair[0], pair[1])
        this.logging({event: 'created', path: pair[0]})
      })

      if (!options.skipVerify) {
        const [firstFilePath] = toWrite[0]
        const pending = await this._pending(context)
        if (!pending.some(p => p.path && path.resolve(p.path) === path.resolve(firstFilePath))) {
          const paths = pending.map(p => p.path).join(', ')
          throw new Error(
            `Expected ${firstFilePath} to be a pending migration but it wasn't! Pending migration paths: ${paths}. You should investigate this. Use skipVerify to bypass this error.`,
          )
        }
      }
    })
  }

  private static defaultCreationTemplate(filepath: string): Array<[string, string]> {
    const ext = path.extname(filepath)
    if ((ext === '.js' && typeof require.main === 'object') || ext === '.cjs') {
      return [[filepath, templates.js]]
    }

    if (ext === '.ts' || ext === '.mts' || ext === '.cts') {
      return [[filepath, templates.ts]]
    }

    if ((ext === '.js' && require.main === undefined) || ext === '.mjs') {
      return [[filepath, templates.mjs]]
    }

    if (ext === '.sql') {
      const downFilepath = path.join(path.dirname(filepath), 'down', path.basename(filepath))
      return [
        [filepath, templates.sqlUp],
        [downFilepath, templates.sqlDown],
      ]
    }

    return []
  }

  private findNameIndex(migrations: Array<RunnableMigration<Ctx>>, name: string) {
    const index = migrations.findIndex(m => m.name === name)
    if (index === -1) {
      throw new Error(`Couldn't find migration to apply with name ${JSON.stringify(name)}`)
    }

    return index
  }

  private findMigrations(migrations: ReadonlyArray<RunnableMigration<Ctx>>, names: readonly string[]) {
    const map = new Map(migrations.map(m => [m.name, m]))
    return names.map(name => {
      const migration = map.get(name)
      if (!migration) {
        throw new Error(`Couldn't find migration to apply with name ${JSON.stringify(name)}`)
      }

      return migration
    })
  }

  private async getContext(): Promise<Ctx> {
    const {context = {}} = this.options
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return typeof context === 'function' ? context() : context
  }

  /** helper for parsing input migrations into a callback returning a list of ready-to-run migrations */
  private getMigrationsResolver(
    inputMigrations: InputMigrations<Ctx>,
  ): (ctx: Ctx) => Promise<ReadonlyArray<RunnableMigration<Ctx>>> {
    if (Array.isArray(inputMigrations)) {
      return async () => inputMigrations
    }

    if (typeof inputMigrations === 'function') {
      // Lazy migrations definition, recurse.
      return async ctx => {
        const resolved = await inputMigrations(ctx)
        return this.getMigrationsResolver(resolved)(ctx)
      }
    }

    const fileGlob = inputMigrations.glob
    const [globString, globOptions] = Array.isArray(fileGlob) ? fileGlob : [fileGlob]
    const ignore = typeof globOptions?.ignore === 'string' ? [globOptions.ignore] : globOptions?.ignore

    const resolver: Resolver<Ctx> = inputMigrations.resolve ?? Umzug.defaultResolver

    return async context => {
      const paths = await glob(globString, {...globOptions, ignore, absolute: true})
      paths.sort() // glob returns results in reverse alphabetical order these days, but it has never guaranteed not to do that https://github.com/isaacs/node-glob/issues/570
      return paths.map(unresolvedPath => {
        const filepath = path.resolve(unresolvedPath)
        const name = path.basename(filepath)
        return {
          path: filepath,
          ...resolver({name, path: filepath, context}),
        }
      })
    }
  }
}

class MissingResolverError extends Error {
  constructor(filepath: string) {
    super(`No resolver specified for file ${filepath}. See docs for guidance on how to write a custom resolver.`)
  }
}
