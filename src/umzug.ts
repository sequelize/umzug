import * as path from 'path';
import { EventEmitter } from 'events';
import { promisify } from 'util';
import { UmzugStorage, JSONStorage, verifyUmzugStorage } from './storage';
import * as glob from 'glob';
import { UmzugCLI } from './cli';

const globAsync = promisify(glob);

export type Promisable<T> = T | PromiseLike<T>;

export type LogFn = (message: string) => void;

/** Constructor options for the Umzug class */
export interface UmzugOptions<Ctx = never> {
	/** The migrations that the Umzug instance should perform */
	migrations: InputMigrations<Ctx>;
	/** A logging function. Pass `console` to use stdout, or pass in your own logger. Pass `undefined` explicitly to disable logging. */
	logger: Record<'info' | 'warn' | 'error', LogFn> | undefined;
	/** The storage implementation. By default, `JSONStorage` will be used */
	storage?: UmzugStorage;
	/** An optional context object, which will be passed to each migration function, if defined */
	context?: Ctx;
}

/** Serializeable metadata for a migration. The structure returned by the external-facing `pending()` and `executed()` methods. */
export interface MigrationMeta {
	/** Name - this is used as the migration unique identifier within storage */
	name: string;
	/** An optional filepath for the migration. Note: this may be undefined, since not all migrations correspond to files on the filesystem */
	path?: string;
}

/**
 * A runnable migration. Represents a migration object with an `up` function which can be called directly, with no arguments, and an optional `down` function to revert it.
 */
export interface RunnableMigration<T> extends MigrationMeta {
	/** The effect of applying the migration */
	up: (params: { name: string; path?: string; context?: T }) => Promise<unknown>;
	/** The effect of reverting the migration */
	down?: (params: { name: string; path?: string; context?: T }) => Promise<unknown>;
}

/**
 * Allowable inputs for migrations. Can be either glob instructions for migration files, a list of runnable migrations, or a
 * function which receives a context and returns a list of migrations.
 */
export type InputMigrations<T> =
	| {
			/**
			 * A glob string for migration files. Can also be in the format `[path/to/migrations/*.js', {cwd: 'some/base/dir', ignore: '**ignoreme.js' }]`
			 * See https://npmjs.com/package/glob for more details on the glob format - this package is used internally.
			 */
			glob: string | [string, { cwd?: string; ignore?: string | string[] }];
			/** Will be supplied to every migration function. Can be a database client, for example */
			context?: T;
			/** A function which takes a migration name, path and context, and returns an object with `up` and `down` functions. */
			resolve?: Resolver<T>;
	  }
	| Array<RunnableMigration<T>>
	| ((context: T) => Promisable<Array<RunnableMigration<T>>>);

/** A function which takes a migration name, path and context, and returns an object with `up` and `down` functions. */
export type Resolver<T> = (params: { name: string; path?: string; context: T }) => RunnableMigration<T>;

export const RerunBehavior = {
	/** Hard error if an up migration that has already been run, or a down migration that hasn't, is encountered */
	THROW: 'THROW',
	/** Silently skip up migrations that have already been run, or down migrations that haven't */
	SKIP: 'SKIP',
	/** Re-run up migrations that have already been run, or down migrations that haven't */
	ALLOW: 'ALLOW',
} as const;

export type RerunBehavior = keyof typeof RerunBehavior;

export type MigrateUpOptions =
	| {
			/** If specified, migrations up to and including this name will be run. Otherwise, all pending migrations will be run */
			to?: string;

			/** Should not be specified with `to` */
			migrations?: never;

			/** Should not be specified with `to` */
			rerun?: never;
	  }
	| {
			/** If specified, only the migrations with these names migrations will be run. An error will be thrown if any of the names are not found in the list of available migrations */
			migrations: string[];

			/** What to do if a migration that has already been run is explicitly specified. Default is `THROW`. */
			rerun?: RerunBehavior;

			/** Should not be specified with `migrations` */
			to?: never;
	  };

export type MigrateDownOptions =
	| {
			/** If specified, migrations down to and including this name will be revert. Otherwise, only the last executed will be reverted */
			to?: string | 0;

			/** Should not be specified with `to` */
			migrations?: never;

			/** Should not be specified with `to` */
			rerun?: never;
	  }
	| {
			/**
			 * If specified, only the migrations with these names migrations will be reverted. An error will be thrown if any of the names are not found in the list of executed migrations.
			 * Note, migrations will be run in the order specified.
			 */
			migrations: string[];

			/** What to do if a migration that has not been run is explicitly specified. Default is `THROW`. */
			rerun?: RerunBehavior;

			/** Should not be specified with `migrations` */
			to?: never;
	  };

export class Umzug<Ctx> extends EventEmitter {
	private readonly storage: UmzugStorage;
	private readonly migrations: () => Promise<ReadonlyArray<RunnableMigration<Ctx>>>;

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
		migration: (params: { name: string; path?: string; context: Ctx }) => Promise<unknown>;
	};

	/** creates a new Umzug instance */
	constructor(private readonly options: UmzugOptions<Ctx>) {
		super();

		this.storage = verifyUmzugStorage(options.storage ?? new JSONStorage());
		this.migrations = this.getMigrationsResolver();
	}

	private logging(message: string) {
		this.options.logger?.info(message);
	}

	static defaultResolver: Resolver<unknown> = ({ name, path: filepath }) => {
		if (!filepath) {
			throw new Error(`Can't use default resolver for non-filesystem migrations`);
		}

		const ext = path.extname(filepath);
		const canRequire = ext === '.js' || ext in require.extensions;
		const languageSpecificHelp: Record<string, string> = {
			'.ts':
				"You can use the default resolver with typescript files by adding `ts-node` as a dependency and calling `require('ts-node/register')` at the program entrypoint before running migrations.",
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

		const getModule = () => require(filepath);

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
		const cli = new UmzugCLI('<script>', () => this);
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
		const [migrations, executedNames] = await Promise.all([this.migrations(), this.storage.executed()]);
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
		const [migrations, executedNames] = await Promise.all([this.migrations(), this.storage.executed()]);
		const executedSet = new Set(executedNames);
		return migrations.filter(m => !executedSet.has(m.name));
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

			let sliceIndex = allPending.length;
			if (options.to) {
				sliceIndex = this.findNameIndex(allPending, options.to) + 1;
			}

			return allPending.slice(0, sliceIndex);
		};

		const toBeApplied = await eligibleMigrations();

		for (const m of toBeApplied) {
			const start = Date.now();
			this.logging('== ' + m.name + ': migrating =======');
			this.emit('migrating', m.name, m);

			await m.up({ name: m.name, path: m.path, context: this.options.context });

			await this.storage.logMigration(m.name);

			const duration = ((Date.now() - start) / 1000).toFixed(3);
			this.logging(`== ${m.name}: migrated (${duration}s)\n`);
			this.emit('migrated', m.name, m);
		}

		return toBeApplied.map(m => ({ name: m.name, path: m.path }));
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

			let sliceIndex = 1;
			if (options.to === 0 || options.migrations) {
				sliceIndex = executedReversed.length;
			} else if (options.to) {
				sliceIndex = this.findNameIndex(executedReversed, options.to) + 1;
			}

			return executedReversed.slice(0, sliceIndex);
		};

		const toBeReverted = await eligibleMigrations();

		for (const m of toBeReverted) {
			const start = Date.now();
			this.logging('== ' + m.name + ': reverting =======');
			this.emit('reverting', m.name, m);

			await m.down?.({ name: m.name, path: m.path, context: this.options.context });

			await this.storage.unlogMigration(m.name);

			const duration = ((Date.now() - start) / 1000).toFixed(3);
			this.logging(`== ${m.name}: reverted (${duration}s)\n`);
			this.emit('reverted', m.name, m);
		}

		return toBeReverted.map(m => ({ name: m.name, path: m.path }));
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
