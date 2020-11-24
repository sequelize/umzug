import * as path from 'path';
import * as fs from 'fs';
import { promisify } from 'util';
import { UmzugStorage, JSONStorage, verifyUmzugStorage } from './storage';
import * as glob from 'glob';
import { UmzugCLI } from './cli';
import { MergeExclusive } from './type-util';
import * as emittery from 'emittery';

const globAsync = promisify(glob);

export type Promisable<T> = T | PromiseLike<T>;

export type LogFn = (message: Record<string, unknown>) => void;

/** Constructor options for the Umzug class */
export interface UmzugOptions<Ctx = never> {
	/** The migrations that the Umzug instance should perform */
	migrations: InputMigrations<Ctx>;
	/** A logging function. Pass `console` to use stdout, or pass in your own logger. Pass `undefined` explicitly to disable logging. */
	logger: Record<'info' | 'warn' | 'error' | 'debug', LogFn> | undefined;
	/** The storage implementation. By default, `JSONStorage` will be used */
	storage?: UmzugStorage<Ctx>;
	/** An optional context object, which will be passed to each migration function, if defined */
	context?: Ctx;
	/** Options for file creation */
	create?: {
		/**
		 * A function for generating placeholder migration files. Specify to make sure files generated using `.create` follow team conventions.
		 * Should return an array of [filepath, content] pairs. Usually, only one pair is needed, but to put `down` migrations in a separate
		 * file, more than one can be returned.
		 */
		template?: (filepath: string) => Array<[string, string]>;
		/**
		 * The default folder that new migration files should be generated in. If this is not specified, the new migration file will be created
		 * in the same folder as the last existing migration. The value here can be overriden by passing `folder` when calling `create`.
		 */
		folder?: string;
	};
}

/** Serializeable metadata for a migration. The structure returned by the external-facing `pending()` and `executed()` methods. */
export interface MigrationMeta {
	/** Name - this is used as the migration unique identifier within storage */
	name: string;
	/** An optional filepath for the migration. Note: this may be undefined, since not all migrations correspond to files on the filesystem */
	path?: string;
}

export interface MigrationParams<T> {
	name: string;
	path?: string;
	context: T;
}

/**
 * A runnable migration. Represents a migration object with an `up` function which can be called directly, with no arguments, and an optional `down` function to revert it.
 */
export interface RunnableMigration<T> extends MigrationMeta {
	/** The effect of applying the migration */
	up: (params: MigrationParams<T>) => Promise<unknown>;
	/** The effect of reverting the migration */
	down?: (params: MigrationParams<T>) => Promise<unknown>;
}

/** Glob instructions for migration files */
export type GlobInputMigrations<T> = {
	/**
	 * A glob string for migration files. Can also be in the format `[path/to/migrations/*.js', {cwd: 'some/base/dir', ignore: '**ignoreme.js' }]`
	 * See https://npmjs.com/package/glob for more details on the glob format - this package is used internally.
	 */
	glob: string | [string, { cwd?: string; ignore?: string | string[] }];
	/** Will be supplied to every migration function. Can be a database client, for example */
	/** A function which takes a migration name, path and context, and returns an object with `up` and `down` functions. */
	resolve?: Resolver<T>;
};

/**
 * Allowable inputs for migrations. Can be either glob instructions for migration files, a list of runnable migrations, or a
 * function which receives a context and returns a list of migrations.
 */
export type InputMigrations<T> =
	| GlobInputMigrations<T>
	| Array<RunnableMigration<T>>
	| ((context: T) => Promisable<Array<RunnableMigration<T>>>);

/** A function which takes a migration name, path and context, and returns an object with `up` and `down` functions. */
export type Resolver<T> = (params: MigrationParams<T>) => RunnableMigration<T>;

export const RerunBehavior = {
	/** Hard error if an up migration that has already been run, or a down migration that hasn't, is encountered */
	THROW: 'THROW',
	/** Silently skip up migrations that have already been run, or down migrations that haven't */
	SKIP: 'SKIP',
	/** Re-run up migrations that have already been run, or down migrations that haven't */
	ALLOW: 'ALLOW',
} as const;

export type RerunBehavior = keyof typeof RerunBehavior;

export type MigrateUpOptions = MergeExclusive<
	{
		/** If specified, migrations up to and including this name will be run. Otherwise, all pending migrations will be run */
		to?: string;
	},
	{
		/** Only run this many migrations. If not specified, all pending migrations will be run */
		step: number;
	},
	{
		/** If specified, only the migrations with these names migrations will be run. An error will be thrown if any of the names are not found in the list of available migrations */
		migrations: string[];

		/** What to do if a migration that has already been run is explicitly specified. Default is `THROW`. */
		rerun?: RerunBehavior;
	}
>;

export type MigrateDownOptions = MergeExclusive<
	{
		/** If specified, migrations down to and including this name will be revert. Otherwise, only the last executed will be reverted */
		to?: string | 0;
	},
	{
		/** Revert this many migrations. If not specified, only the most recent migration will be reverted */
		step: number;
	},
	{
		/**
		 * If specified, only the migrations with these names migrations will be reverted. An error will be thrown if any of the names are not found in the list of executed migrations.
		 * Note, migrations will be run in the order specified.
		 */
		migrations: string[];

		/** What to do if a migration that has not been run is explicitly specified. Default is `THROW`. */
		rerun?: RerunBehavior;
	}
>;

export class Umzug<Ctx> extends emittery.Typed<
	Record<'migrating' | 'migrated' | 'reverting' | 'reverted', MigrationParams<Ctx>> &
		Record<'beforeAll' | 'afterAll', { context: Ctx }>
> {
	private readonly storage: UmzugStorage<Ctx>;
	/** @internal */
	readonly migrations: () => Promise<ReadonlyArray<RunnableMigration<Ctx>>>;

	/**
	 * Compile-time only property for type inference. After creating an Umzug instance, it can be used as type alias for
	 * a user-defined migration. The function receives a migration name, path and the context for an umzug instance
	 * @example
	 * // migrator.ts
	 * import { Umzug } from 'umzug'
	 *
	 * const umzug = new Umzug({...})
	 * export type Migration = typeof umzug._types.migration;
	 *
	 * umzug.up();
	 *
	 * @example
	 * // migration-1.ts
	 * import type { Migration } from '../migrator'
	 *
	 * // name and context will now be strongly-typed
	 * export const up: Migration = ({name, context}) => context.query(...)
	 * export const down: Migration = ({name, context}) => context.query(...)
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
				if (e instanceof Error && filepath.endsWith('.ts')) {
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
	 * 'Run' an umzug instance as a CLI. This will read `process.argv`, execute commands based on that, and call
	 * `process.exit` after running. If that isn't what you want, stick to the programmatic API.
	 * You probably want to run only if a file is executed as the process's 'main' module with something like:
	 * @example
	 * if (require.main === module) {
	 *   myUmzugInstance.runAsCLI()
	 * }
	 */
	async runAsCLI(argv?: string[]): Promise<boolean> {
		const cli = new UmzugCLI(this);
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

				await m.up(params);

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

				await m.down?.(params);

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
			if (!pending.some(p => p.path === filepath)) {
				throw new Error(
					`Expected ${filepath} to be a pending migration but it wasn't! You should investigate this. Use skipVerify to bypass this error.`
				);
			}
		}
	}

	private static defaultCreationTemplate(filepath: string): Array<[string, string]> {
		const dedent = (content: string) =>
			content
				.split('\n')
				.map(line => line.trim())
				.join('\n')
				.trimStart();

		const ext = path.extname(filepath);
		if (ext === '.js' || ext === '.cjs') {
			const content = dedent(`
				exports.up = params => {};
				exports.down = params => {};
			`);
			return [[filepath, content]];
		}

		if (ext === '.ts') {
			const content = dedent(`
				import { MigrationFn } from 'umzug';

				export const up: MigrationFn = params => {};
				export const down: MigrationFn = params => {};
			`);
			return [[filepath, content]];
		}

		if (ext === '.mjs') {
			const content = dedent(`
				export const up = params => {};
				export const down = params => {};
			`);
			return [[filepath, content]];
		}

		if (ext === '.sql') {
			const downFilepath = path.join(path.dirname(filepath), 'down', path.basename(filepath));
			return [
				[filepath, '-- up migration'],
				[downFilepath, '-- down migration'],
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
