import {z, trpcServer} from 'trpc-cli'
import {MigrateUpOptions, MigrateDownOptions} from './types'
import {Umzug as Migrator} from './umzug'

export interface MigratorRouterContext {
  migrator: Migrator
}

/** Helper type that IMO should exist in trpc. Basically a type which a trpc-procedure with context of type `Ctx` will satisfy */
export type TRPCProcedureLike<Ctx> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mutation: (resolver: (opts: {ctx: Ctx; input: any}) => any) => any
}

/** Parameters needed for a helper function returning a router, which can be used as a sub-router for another. */
export interface TRPCHelperParams<Ctx> {
  /** The `trpc.procedure` function. A middleware can be used to align context types. */
  procedure: TRPCProcedureLike<Ctx>
}

export const migratorTrpc = trpcServer.initTRPC
  .context<MigratorRouterContext>()
  .create() satisfies TRPCHelperParams<MigratorRouterContext> // use `satisfies` to make sure the `TRPCProcedureLike` type helper is correct

/**
 * Get a router with procedures needed to manage migrations.
 *
 * @param procedure - TRPC procedure builder for the router this will be attached to. Must have the correct context type
 *
 * @example
 * import {createMigratorRouter, Migrator} from 'umzug'
 * import {initTRPC} from '@trpc/server'
 *
 * const t = initTRPC.context<YourAppContext>().create()
 *
 * export const yourAppRouter = t.router({
 *   yourProcedeure: t.procedure.query(async () => 'Hello, world!'),
 *   migrations: getMigrationsRouter(),
 * })
 *
 * function getMigrationsRouter() {
 *   return createMigratorRouter(
 *     t.procedure.use(async ({ctx, next}) => {
 *       return next({
 *         ctx: {
 *           migrator: new Migrator(___),
 *           confirm: async (sql: string) => {
 *             return ctx.whitelistedSql.includes(sql)
 *           },
 *         }
 *       })
 *     })
 *   )
 * }
 */
export const createMigratorRouter = (procedure: TRPCProcedureLike<MigratorRouterContext> = migratorTrpc.procedure) => {
  // Take advantage of trpc being overly lax about merging routers with different contexts: https://github.com/trpc/trpc/issues/4306
  // We have used the `TRPCProcedureLike` type to ensure that the context is correct for the procedure builder, and trpc will merge the routers without checking the context
  // This means any router with a different context type can use this helper to creater a migrations sub-router, by just defining a middleware that sets the correct context
  const trpc = {router: migratorTrpc.router, procedure: procedure} as typeof migratorTrpc

  const router = migratorTrpc.router({
    up: trpc.procedure
      .meta({description: 'Apply pending migrations'})
      .input(
        z.object({
          to: z.string().describe('All migrations up to and including this one should be applied').optional(),
          step: z
            .number()
            .int()
            .positive()
            .optional()
            .describe('Apply this many migrations. If not specified, all will be applied.'),
          name: z
            .string()
            .array()
            .optional()
            .describe('Explicitly declare migration name(s) to be applied. Only these migrations will be applied.'),
          rerun: z
            .enum(['THROW', 'SKIP', 'ALLOW'])
            .describe('What to do if a migration that has already been applied is passed to --name')
            .default('THROW'),
        }),
      )
      .mutation(async ({input, ctx}) => {
        const {to, step, name: nameArray, rerun = 'THROW'} = input
        const migrations = nameArray?.length ? nameArray : undefined

        if (to && migrations) {
          throw new Error(`Can't specify 'to' and 'name' together`)
        }

        if (to && typeof step === 'number') {
          throw new Error(`Can't specify 'to' and 'step' together`)
        }

        if (typeof step === 'number' && migrations) {
          throw new Error(`Can't specify 'step' and 'name' together`)
        }

        if (rerun !== 'THROW' && !migrations) {
          throw new Error(`Can't specify 'rerun' without 'name'`)
        }

        const result = await ctx.migrator.up({to, step, migrations, rerun} as MigrateUpOptions)
        ctx.migrator.options.logger?.info({event: 'up', message: `applied ${result.length} migrations.`})
      }),
    down: trpc.procedure
      .meta({description: 'Revert one or more migrations'})
      .input(
        z
          .object({
            to: z
              .string()
              .describe("All migrations up to and including this one should be reverted. Pass '0' to revert all."),
            step: z
              .number()
              .int()
              .positive()
              .describe(
                'Revert this many migrations. If not specified, only the most recent migration will be reverted.',
              ),
            name: z
              .string()
              .array()
              .describe('Explicitly declare migration name(s) to be reverted. Only these migrations will be reverted.'),
            rerun: z
              .enum(['THROW', 'SKIP', 'ALLOW'])
              .default('THROW')
              .describe('What to do if a migration that has not been applied is passed to --name'),
          })
          .partial(),
      )
      .mutation(async ({input, ctx}) => {
        const {to: _to, step, name: nameArray, rerun = 'THROW'} = input
        const migrations = nameArray?.length ? nameArray : undefined
        if (_to && migrations) {
          throw new Error(`Can't specify 'to' and 'name' together`)
        }

        if (_to && typeof step === 'number') {
          throw new Error(`Can't specify 'to' and 'step' together`)
        }

        if (typeof step === 'number' && migrations) {
          throw new Error(`Can't specify 'step' and 'name' together`)
        }

        if (rerun !== 'THROW' && !migrations) {
          throw new Error(`Can't specify 'rerun' without 'name'`)
        }

        const to = _to === '0' ? 0 : _to
        const result = await ctx.migrator.down({to, step, migrations, rerun} as MigrateDownOptions)
        ctx.migrator.options.logger?.info({event: 'down', message: `reverted ${result.length} migrations.`})
      }),
    create: trpc.procedure
      .meta({description: 'Create a new migration file'})
      .input(
        z.object({
          content: z.string().optional().describe('Content of the migration.'),
          name: z.string().describe('Name of the migration file.'),
          prefix: z
            .enum(['TIMESTAMP', 'DATE', 'NONE'])
            .optional()
            .describe(
              'The prefix format for generated files. TIMESTAMP uses a second-resolution timestamp, DATE uses a day-resolution timestamp, and NONE removes the prefix completely',
            ),
          folder: z
            .string()
            .optional()
            .describe(
              'Path on the filesystem where the file should be created. The new migration will be created as a sibling of the last existing one if this is omitted.',
            ),
          allowExtension: z
            .string()
            .optional()
            .describe(
              `Allowable extension for created files. By default .js, .ts and .sql files can be created. To create txt file migrations, for example, you could use '--name my-migration.txt --allow-extension .txt'`,
            ),
          skipVerify: z
            .boolean()
            .optional()
            .describe(
              `By default, the generated file will be checked after creation to make sure it is detected as a pending migration. This catches problems like creation in the wrong folder, or invalid naming conventions. ` +
                `This flag bypasses that verification step.`,
            ),
          allowConfusingOrdering: z
            .boolean()
            .optional()
            .describe(
              `By default, an error will be thrown if you try to create a migration that will run before a migration that already exists. ` +
                `This catches errors which can cause problems if you change file naming conventions. ` +
                `If you use a custom ordering system, you can disable this behavior, but it's strongly recommended that you don't! ` +
                `If you're unsure, just ignore this option.`,
            ),
        }),
      )
      .mutation(async ({input, ctx}) => {
        await ctx.migrator.create(input)
      }),
    pending: trpc.procedure
      .meta({description: 'List migrations due to be applied'})
      .input(
        z.object({
          json: z
            .boolean()
            .describe(
              `Print pending migrations in a json format including names and paths. This allows piping output to tools like jq. ` +
                `Without this flag, the migration names will be printed one per line.`,
            ),
        }),
      )
      .query(async ({ctx, input}) => {
        const migrations = await ctx.migrator.pending()
        const formatted = input.json ? JSON.stringify(migrations, null, 2) : migrations.map(m => m.name).join('\n')
        // eslint-disable-next-line no-console
        console.log(formatted)
      }),
    executed: trpc.procedure
      .meta({description: 'List migrations that have been applie'})
      .input(
        z.object({
          json: z
            .boolean()
            .describe(
              `Print pending migrations in a json format including names and paths. This allows piping output to tools like jq. ` +
                `Without this flag, the migration names will be printed one per line.`,
            ),
        }),
      )
      .query(async ({ctx, input}) => {
        const migrations = await ctx.migrator.executed()
        const formatted = input.json ? JSON.stringify(migrations, null, 2) : migrations.map(m => m.name).join('\n')
        // eslint-disable-next-line no-console
        console.log(formatted)
      }),
  })

  return router
}
