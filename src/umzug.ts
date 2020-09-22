import * as path from 'path';
import { EventEmitter } from 'events';
import * as pEachSeries from 'p-each-series';
import { promisify } from 'util';
import { UmzugStorage, JSONStorage, verifyUmzugStorage } from './storage';
import * as glob from 'glob';
import { basename, extname } from 'path';

export type Promisable<T> = T | PromiseLike<T>;

/** Constructor options for the Umzug class */
export interface UmzugOptions<Ctx = never> {
	/** The migrations that the Umzug instance should perform */
	migrations: InputMigrations<Ctx>;
	/** A logging function. Pass `console` to use stdout, or pass in your own logger. Pass `undefined` explicitly to disable logging. */
	logger: Pick<Console, 'info' | 'warn' | 'error'> | undefined;
	/** The storage implementation. By default, `JSONStorage` will be used */
	storage?: UmzugStorage;
	/** An optional context object, which will be passed to each migration function, if defined */
	context?: Ctx;
}

/** Serializeable metadata for a migration. The structure returned by the external-facing `pending()` and `executed()` methods. */
export interface MigrationMeta {
	/** Name - this is used to identify the migration persistently in storage */
	name: string;
	/** An optional filepath for the migration. Note: this may be undefined, since not all migrations correspond to files on the filesystem */
	path?: string;
}

/**
 * A runnable migration. Represents a migration object with an `up` function which can be called directly, with no arguments.
 */
export interface RunnableMigration extends MigrationMeta {
	/** The effect of applying the migration */
	up: () => Promise<unknown>;
	/** The effect of reverting the migration */
	down?: () => Promise<unknown>;
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
			/** A function which returns `up` and `down` function, from a migration name, path and context. */
			resolve?: Resolver<T>;
	  }
	| RunnableMigration[]
	| ((context: T) => Promisable<RunnableMigration[]>);

/**
 * A helper property for type inference.
export type MigrationFn<U extends Umzug<any>> = U extends Umzug<infer Ctx>
	? (params: { name: string; path?: string; context: Ctx }) => Promise<unknown>
	: never;

/** A function which returns `up` and `down` function, from a migration name, path and context. */
export type Resolver<T> = (params: { path: string; name: string; context: T }) => RunnableMigration;

export type MigrateUpOptions =
	| {
			/** If specified, migrations up to and including this name will be run. Otherwise, all will be run */
			to?: string;

			/** Should not be specified with `to` */
			migrations?: never;

			/** Should not be specified with `to` */
			force?: never;
	  }
	| {
			/** If specified, only these migrations will be run. An error will be thrown if any of the names are not found in the list of available migrations */
			migrations?: string[];

			/** Allow re-applying already-executed migrations. Use with caution. */
			force?: boolean;

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
			force?: never;
	  }
	| {
			/** If specified, only these migrations will be reverted. An error will be thrown if any of the names are not found in the list of executed migrations */
			migrations: string[];

			/** Allow reverting migrations which have not been run yet. Use with caution. */
			force?: boolean;

			/** Should not be specified with `migrations` */
			to?: never;
	  };

export class Umzug<Ctx> extends EventEmitter {
	private readonly storage: UmzugStorage;
	private readonly migrations: () => Promise<readonly RunnableMigration[]>;
	private readonly logging: (message: string) => void;

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
	 * export const up: MigrationFn = ({name, context}) => context.query(...)
	 * export const down: MigrationFn = ({name, context}) => context.query(...)
	 */
	readonly _types: {
		migration: (params: { name: string; path?: string; context: Ctx }) => Promise<unknown>;
	} = {} as any;

	/** creates a new Umzug instance */
	constructor(private readonly options: UmzugOptions<Ctx>) {
		super();

		this.storage = verifyUmzugStorage(options.storage || new JSONStorage());
		this.migrations = this.getMigrationsResolver();
		this.logging = options.logger?.info || (() => {});
	}

	static defaultResolver: Resolver<unknown> = ({ path: filepath, name, context }) => {
		const ext = path.extname(filepath);
		const canRequire = ext === '.js' || ext in require.extensions;
		const languageSpecificHelp: Record<string, string> = {
			'.ts':
				"You can use the default resolver with typescript files by adding `ts-node` as a dependency and calling `require('ts-node/register')` before running migrations.",
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
			up: async () => getModule().up({ path: filepath, name, context }) as unknown,
			down: async () => getModule().down({ path: filepath, name, context }) as unknown,
		};
	};

	/**
	 * create a clone of the current Umzug instance, allowing customising the list of migrations.
	 * For example, this could be used to re-order the list of migrations.
	 */
	extend(fn: (migrations: readonly RunnableMigration[]) => Promisable<RunnableMigration[]>): Umzug<Ctx> {
		return new Umzug({
			...this.options,
			migrations: async () => {
				const migrations = await this.migrations();
				return fn(migrations);
			},
		});
	}

	/** Get the list of migrations which have already been applied */
	async executed(): Promise<MigrationMeta[]> {
		const list = await this._executed();
		return list.map(m => ({ name: m.name, path: m.path }));
	}

	/** Get the list of migrations which have already been applied */
	private async _executed(): Promise<RunnableMigration[]> {
		const [migrations, executedNames] = await Promise.all([this.migrations(), this.storage.executed()]);
		const executedSet = new Set(executedNames);
		return migrations.filter(m => executedSet.has(m.name));
	}

	/** Get the list of migrations which are yet to be applied */
	async pending(): Promise<MigrationMeta[]> {
		const list = await this._pending();
		return list.map(m => ({ name: m.name, path: m.path }));
	}

	private async _pending(): Promise<RunnableMigration[]> {
		const [migrations, executedNames] = await Promise.all([this.migrations(), this.storage.executed()]);
		const executedSet = new Set(executedNames);
		return migrations.filter(m => !executedSet.has(m.name));
	}

	/**
	 * Apply migrations. By default, runs all pending migrations.
	 * @see MigrateUpOptions for other use cases using `to`, `migrations` and `force`.
	 */
	async up(options: MigrateUpOptions = {}): Promise<void> {
		const eligibleMigrations = async () => {
			if (options.migrations && options.force) {
				// `force` means the specified migrations should be run even if they've run before - so get all migrations, not just pending
				const list = await this.migrations();
				return this.findMigrations(list.slice(), options.migrations);
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

		await pEachSeries(toBeApplied, async m => {
			const start = Date.now();
			this.logging('== ' + m.name + ': migrating =======');
			this.emit('migrating', m.name, m);

			await m.up();

			await this.storage.logMigration(m.name);

			const duration = ((Date.now() - start) / 1000).toFixed(3);
			this.logging(`== ${m.name}: migrated (${duration}s)\n`);
			this.emit('migrated', m.name, m);
		});
	}

	/**
	 * Revert migrations. By default, the last executed migration is reverted.
	 * @see MigrateDownOptions for other use cases using `to`, `migrations` and `force`.
	 */
	async down(options: MigrateDownOptions = {}): Promise<void> {
		const eligibleMigrations = async () => {
			if (options.migrations && options.force) {
				const list = await this.migrations();
				return this.findMigrations(list.slice(), options.migrations);
			}

			if (options.migrations) {
				return this.findMigrations(await this._executed(), options.migrations);
			}

			const executedReversed = await this._executed().then(e => e.slice().reverse());

			let sliceIndex = 1;
			if (options.to === 0 || options.migrations) {
				sliceIndex = executedReversed.length;
			} else if (options.to) {
				sliceIndex = this.findNameIndex(executedReversed, options.to) + 1;
			}

			return executedReversed.slice(0, sliceIndex);
		};

		const toBeReverted = await eligibleMigrations();

		await pEachSeries(toBeReverted, async m => {
			const start = Date.now();
			this.logging('== ' + m.name + ': reverting =======');
			this.emit('reverting', m.name, m);

			await m.down?.();

			await this.storage.unlogMigration(m.name);

			const duration = ((Date.now() - start) / 1000).toFixed(3);
			this.logging(`== ${m.name}: reverted (${duration}s)\n`);
			this.emit('reverted', m.name, m);
		});
	}

	private findNameIndex(migrations: RunnableMigration[], name: string) {
		const index = migrations.findIndex(m => m.name === name);
		if (index === -1) {
			throw new Error(`Couldn't find migration to apply with name ${JSON.stringify(name)}`);
		}

		return index;
	}

	private findMigrations(migrations: RunnableMigration[], names: string[]) {
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
	private getMigrationsResolver(): () => Promise<readonly RunnableMigration[]> {
		const { migrations: inputMigrations, context } = this.options;
		if (Array.isArray(inputMigrations)) {
			return async () => inputMigrations;
		}

		if (typeof inputMigrations === 'function') {
			return async () => inputMigrations(context);
		}

		const fileGlob = inputMigrations.glob;
		const [globString, globOptions]: Parameters<typeof glob.sync> = Array.isArray(fileGlob) ? fileGlob : [fileGlob];

		const resolver: Resolver<Ctx> = inputMigrations.resolve || Umzug.defaultResolver;

		return async () => {
			const globAsync = promisify(glob);
			const paths = await globAsync(globString, { ...globOptions, absolute: true });
			return paths.map(unresolvedPath => {
				const filepath = path.resolve(unresolvedPath);
				const name = basename(filepath, extname(filepath));
				return {
					name,
					path: filepath,
					...resolver({ context, path: filepath, name }),
				};
			});
		};
	}
}
