import * as path from 'path';
import * as fs from 'fs';
import { promisify } from 'util';
import { UmzugStorage, JSONStorage, verifyUmzugStorage } from './storage';
import * as templates from './templates';
import * as glob from 'glob';
import { UmzugCLI } from './cli';
import * as emittery from 'emittery';
import * as VError from 'verror';
import {
	MigrateDownOptions,
	MigrateUpOptions,
	MigrationMeta,
	MigrationParams,
	Promisable,
	RerunBehavior,
	Resolver,
	RunnableMigration,
	UmzugEvents,
	UmzugOptions,
} from './types';

const globAsync = promisify(glob);

interface MigrationErrorParams extends MigrationParams<unknown> {
	direction: 'up' | 'down';
}

export class Rethrowable extends VError {
	static wrap(throwable: unknown): VError {
		if (throwable instanceof VError) {
			return throwable;
		}

		if (throwable instanceof Error) {
			return new VError(throwable, 'Original error');
		}

		return new VError(
			{
				info: { original: throwable },
			},
			`Non-error value thrown. See info for full props: %s`,
			throwable
		);
	}
}

export class MigrationError extends VError {
	constructor(migration: MigrationErrorParams, original: unknown) {
		super(
			{
				cause: Rethrowable.wrap(original),
				name: 'MigrationError',
				info: migration,
			},
			'Migration %s (%s) failed',
			migration.name,
			migration.direction
		);
	}
}

export class Umzug<Ctx = unknown> extends emittery.Typed<UmzugEvents<Ctx>> {
	private readonly storage: UmzugStorage<Ctx>;
	/** @internal */
	readonly migrations: () => Promise<ReadonlyArray<RunnableMigration<Ctx>>>;

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
		migration: (params: MigrationParams<Ctx>) => Promise<unknown>;
	};

	/** creates a new Umzug instance */
	constructor(
		/** @internal */
		readonly options: UmzugOptions<Ctx>
	) {
		super();

		this.storage = verifyUmzugStorage(options.storage ?? new JSONStorage());
		this.migrations = this.getMigrationsResolver();
	}

	private get context(): Ctx {
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- safe because options.context is only undefined if Ctx's type is undefined
		return this.options.context!;
	}

	private logging(message: Record<string, unknown>) {
		this.options.logger?.info(message);
	}

	static defaultResolver: Resolver<unknown> = ({ name, path: filepath }) => {
		if (!filepath) {
			throw new Error(`Can't use default resolver for non-filesystem migrations`);
		}

		const ext = path.extname(filepath);
		const canRequire = ext === '.js' || ext === '.cjs' || ext === '.ts';
		const languageSpecificHelp: Record<string, string> = {
			'.ts':
				"TypeScript files can be required by adding `ts-node` as a dependency and calling `require('ts-node/register')` at the program entrypoint before running migrations.",
			'.sql': 'Try writing a resolver which reads file content and executes it as a sql query.',
		};
		if (!canRequire) {
			const errorParts = [
				`No resolver specified for file ${filepath}.`,
				languageSpecificHelp[ext],
				`See docs for guidance on how to write a custom resolver.`,
			];
			throw new Error(errorParts.filter(Boolean).join(' '));
		}

		const getModule = () => {
			try {
				return require(filepath);
			} catch (e: unknown) {
				if (e instanceof SyntaxError && filepath.endsWith('.ts')) {
					e.message += '\n\n' + languageSpecificHelp['.ts'];
				}

				throw e;
			}
		};

		return {
			name,
			path: filepath,
			up: async ({ context }) => getModule().up({ path: filepath, name, context }) as unknown,
			down: async ({ context }) => getModule().down({ path: filepath, name, context }) as unknown,
		};
	};

	/**
	 * Get an UmzugCLI instance. This can be overriden in a subclass to add/remove commands - only use if you really know you need this,
	 * and are OK to learn about/interact with the API of @rushstack/ts-command-line.
	 */
	protected getCli(): UmzugCLI {
		return new UmzugCLI(this);
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
		const cli = this.getCli();
		return cli.execute(argv);
	}

	/**
	 * create a clone of the current Umzug instance, allowing customising the list of migrations.
	 * This could be used, for example, to sort the list of migrations in a specific order.
	 */
	extend(
		transform: (migrations: ReadonlyArray<RunnableMigration<Ctx>>) => Promisable<Array<RunnableMigration<Ctx>>>
	): Umzug<Ctx> {
		return new Umzug({
			...this.options,
			migrations: async () => {
				const migrations = await this.migrations();
				return transform(migrations);
			},
		});
	}

	/** Get the list of migrations which have already been applied */
	async executed(): Promise<MigrationMeta[]> {
		const list = await this._executed();
		// We do the following to not expose the `up` and `down` functions to the user
		return list.map(m => ({ name: m.name, path: m.path }));
	}

	/** Get the list of migrations which have already been applied */
	private async _executed(): Promise<ReadonlyArray<RunnableMigration<Ctx>>> {
		const [migrations, executedNames] = await Promise.all([
			this.migrations(),
			this.storage.executed({ context: this.context }),
		]);
		const executedSet = new Set(executedNames);
		return migrations.filter(m => executedSet.has(m.name));
	}

	/** Get the list of migrations which are yet to be applied */
	async pending(): Promise<MigrationMeta[]> {
		const list = await this._pending();
		// We do the following to not expose the `up` and `down` functions to the user
		return list.map(m => ({ name: m.name, path: m.path }));
	}

	private async _pending(): Promise<Array<RunnableMigration<Ctx>>> {
		const [migrations, executedNames] = await Promise.all([
			this.migrations(),
			this.storage.executed({ context: this.context }),
		]);
		const executedSet = new Set(executedNames);
		return migrations.filter(m => !executedSet.has(m.name));
	}

	private async withBeforeAfterHooks<T>(cb: () => Promise<T>): Promise<T> {
		await this.emit('beforeAll', { context: this.context });
		try {
			return await cb();
		} finally {
			await this.emit('afterAll', { context: this.context });
		}
	}

	/**
	 * Apply migrations. By default, runs all pending migrations.
	 * @see MigrateUpOptions for other use cases using `to`, `migrations` and `rerun`.
	 */
	async up(options: MigrateUpOptions = {}): Promise<MigrationMeta[]> {
		const eligibleMigrations = async () => {
			if (options.migrations && options.rerun === RerunBehavior.ALLOW) {
				// Allow rerun means the specified migrations should be run even if they've run before - so get all migrations, not just pending
				const list = await this.migrations();
				return this.findMigrations(list, options.migrations);
			}

			if (options.migrations && options.rerun === RerunBehavior.SKIP) {
				const executedNames = new Set((await this._executed()).map(m => m.name));
				const filteredMigrations = options.migrations.filter(m => !executedNames.has(m));
				return this.findMigrations(await this.migrations(), filteredMigrations);
			}

			if (options.migrations) {
				return this.findMigrations(await this._pending(), options.migrations);
			}

			const allPending = await this._pending();

			let sliceIndex = options.step ?? allPending.length;
			if (options.to) {
				sliceIndex = this.findNameIndex(allPending, options.to) + 1;
			}

			return allPending.slice(0, sliceIndex);
		};

		return this.withBeforeAfterHooks(async () => {
			const toBeApplied = await eligibleMigrations();

			for (const m of toBeApplied) {
				const start = Date.now();
				const params: MigrationParams<Ctx> = { name: m.name, path: m.path, context: this.context };

				this.logging({ event: 'migrating', name: m.name });
				await this.emit('migrating', params);

				try {
					await m.up(params);
				} catch (e: unknown) {
					throw new MigrationError({ direction: 'up', ...params }, e);
				}

				await this.storage.logMigration(m.name, params);

				const duration = (Date.now() - start) / 1000;
				this.logging({ event: 'migrated', name: m.name, durationSeconds: duration });
				await this.emit('migrated', params);
			}

			return toBeApplied.map(m => ({ name: m.name, path: m.path }));
		});
	}

	/**
	 * Revert migrations. By default, the last executed migration is reverted.
	 * @see MigrateDownOptions for other use cases using `to`, `migrations` and `rerun`.
	 */
	async down(options: MigrateDownOptions = {}): Promise<MigrationMeta[]> {
		const eligibleMigrations = async () => {
			if (options.migrations && options.rerun === RerunBehavior.ALLOW) {
				const list = await this.migrations();
				return this.findMigrations(list, options.migrations);
			}

			if (options.migrations && options.rerun === RerunBehavior.SKIP) {
				const pendingNames = new Set((await this._pending()).map(m => m.name));
				const filteredMigrations = options.migrations.filter(m => !pendingNames.has(m));
				return this.findMigrations(await this.migrations(), filteredMigrations);
			}

			if (options.migrations) {
				return this.findMigrations(await this._executed(), options.migrations);
			}

			const executedReversed = (await this._executed()).slice().reverse();

			let sliceIndex = options.step ?? 1;
			if (options.to === 0 || options.migrations) {
				sliceIndex = executedReversed.length;
			} else if (options.to) {
				sliceIndex = this.findNameIndex(executedReversed, options.to) + 1;
			}

			return executedReversed.slice(0, sliceIndex);
		};

		return this.withBeforeAfterHooks(async () => {
			const toBeReverted = await eligibleMigrations();

			for (const m of toBeReverted) {
				const start = Date.now();
				const params: MigrationParams<Ctx> = { name: m.name, path: m.path, context: this.context };

				this.logging({ event: 'reverting', name: m.name });
				await this.emit('reverting', params);

				try {
					await m.down?.(params);
				} catch (e: unknown) {
					throw new MigrationError({ direction: 'down', ...params }, e);
				}

				await this.storage.unlogMigration(m.name, params);

				const duration = Number.parseFloat(((Date.now() - start) / 1000).toFixed(3));
				this.logging({ event: 'reverted', name: m.name, durationSeconds: duration });
				await this.emit('reverted', params);
			}

			return toBeReverted.map(m => ({ name: m.name, path: m.path }));
		});
	}

	async create(options: {
		name: string;
		folder?: string;
		prefix?: 'TIMESTAMP' | 'DATE' | 'NONE';
		allowExtension?: string;
		allowConfusingOrdering?: boolean;
		skipVerify?: boolean;
	}): Promise<void> {
		const isoDate = new Date().toISOString();
		const prefixes = {
			TIMESTAMP: isoDate.replace(/\.\d{3}Z$/, '').replace(/\W/g, '.'),
			DATE: isoDate.split('T')[0].replace(/\W/g, '.'),
			NONE: '',
		};
		const prefixType = options.prefix ?? 'TIMESTAMP';
		const fileBasename = [prefixes[prefixType], options.name].filter(Boolean).join('.');

		const allowedExtensions = options.allowExtension
			? [options.allowExtension]
			: ['.js', '.cjs', '.mjs', '.ts', '.sql'];

		const existing = await this.migrations();
		const last = existing[existing.length - 1];

		const confusinglyOrdered = existing.find(e => e.path && path.basename(e.path) > fileBasename);
		if (confusinglyOrdered && !options.allowConfusingOrdering) {
			throw new Error(
				`Can't create ${fileBasename}, since it's unclear if it should run before or after existing migration ${confusinglyOrdered.name}. Use allowConfusingOrdering to bypass this error.`
			);
		}

		const folder = options.folder || this.options.create?.folder || (last?.path && path.dirname(last.path));

		if (!folder) {
			throw new Error(`Couldn't infer a directory to generate migration file in. Pass folder explicitly`);
		}

		const filepath = path.join(folder, fileBasename);

		const template = this.options.create?.template ?? Umzug.defaultCreationTemplate;

		const toWrite = template(filepath);
		if (toWrite.length === 0) {
			toWrite.push([filepath, '']);
		}

		toWrite.forEach(pair => {
			if (!Array.isArray(pair) || pair.length !== 2) {
				throw new Error(
					`Expected [filepath, content] pair. Check that the file template function returns an array of pairs.`
				);
			}

			const ext = path.extname(pair[0]);
			if (!allowedExtensions.includes(ext)) {
				const allowStr = allowedExtensions.join(', ');
				const message = `Extension ${ext} not allowed. Allowed extensions are ${allowStr}. See help for allowExtension to avoid this error.`;
				throw new Error(message);
			}

			fs.mkdirSync(path.dirname(pair[0]), { recursive: true });
			fs.writeFileSync(pair[0], pair[1]);
			this.logging({ event: 'created', path: pair[0] });
		});

		if (!options.skipVerify) {
			const pending = await this.pending();
			if (!pending.some(p => p.path && path.resolve(p.path) === path.resolve(filepath))) {
				throw new Error(
					`Expected ${filepath} to be a pending migration but it wasn't! You should investigate this. Use skipVerify to bypass this error.`
				);
			}
		}
	}

	private static defaultCreationTemplate(filepath: string): Array<[string, string]> {
		const ext = path.extname(filepath);
		if (ext === '.js' || ext === '.cjs') {
			return [[filepath, templates.js]];
		}

		if (ext === '.ts') {
			return [[filepath, templates.ts]];
		}

		if (ext === '.mjs') {
			return [[filepath, templates.mjs]];
		}

		if (ext === '.sql') {
			const downFilepath = path.join(path.dirname(filepath), 'down', path.basename(filepath));
			return [
				[filepath, templates.sqlUp],
				[downFilepath, templates.sqlDown],
			];
		}

		return [];
	}

	private findNameIndex(migrations: Array<RunnableMigration<Ctx>>, name: string) {
		const index = migrations.findIndex(m => m.name === name);
		if (index === -1) {
			throw new Error(`Couldn't find migration to apply with name ${JSON.stringify(name)}`);
		}

		return index;
	}

	private findMigrations(migrations: ReadonlyArray<RunnableMigration<Ctx>>, names: readonly string[]) {
		const map = new Map(migrations.map(m => [m.name, m]));
		return names.map(name => {
			const migration = map.get(name);
			if (!migration) {
				throw new Error(`Couldn't find migration to apply with name ${JSON.stringify(name)}`);
			}

			return migration;
		});
	}

	/** helper for parsing input migrations into a callback returning a list of ready-to-run migrations */
	private getMigrationsResolver(): () => Promise<ReadonlyArray<RunnableMigration<Ctx>>> {
		const inputMigrations = this.options.migrations;
		// Safe to non-null assert - if there's no context passed in, the type of `Ctx` must be `undefined` anyway.
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		const context = this.options.context!;
		if (Array.isArray(inputMigrations)) {
			return async () => inputMigrations;
		}

		if (typeof inputMigrations === 'function') {
			return async () => inputMigrations(context);
		}

		const fileGlob = inputMigrations.glob;
		const [globString, globOptions]: Parameters<typeof glob.sync> = Array.isArray(fileGlob) ? fileGlob : [fileGlob];

		const resolver: Resolver<Ctx> = inputMigrations.resolve ?? Umzug.defaultResolver;

		return async () => {
			const paths = await globAsync(globString, { ...globOptions, absolute: true });
			return paths.map(unresolvedPath => {
				const filepath = path.resolve(unresolvedPath);
				const name = path.basename(filepath);
				return {
					path: filepath,
					...resolver({ name, path: filepath, context }),
				};
			});
		};
	}
}
