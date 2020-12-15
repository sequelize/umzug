import { UmzugStorage } from './storage';
import * as typeFest from 'type-fest';

/**
 * Create a type that has mutually exclusive keys.
 * Wrapper for @see `import('type-fest').MergeExclusive` that works for three types
 */
export type MergeExclusive<A, B, C> = typeFest.MergeExclusive<A, typeFest.MergeExclusive<B, C>>;

export type Promisable<T> = T | PromiseLike<T>;

export type LogFn = (message: Record<string, unknown>) => void;

/** Constructor options for the Umzug class */
export interface UmzugOptions<Ctx extends {} = Record<string, unknown>> {
	/** The migrations that the Umzug instance should perform */
	migrations: InputMigrations<Ctx>;
	/** A logging function. Pass `console` to use stdout, or pass in your own logger. Pass `undefined` explicitly to disable logging. */
	logger: Record<'info' | 'warn' | 'error' | 'debug', LogFn> | undefined;
	/** The storage implementation. By default, `JSONStorage` will be used */
	storage?: UmzugStorage<Ctx>;
	/** An optional context object, which will be passed to each migration function, if defined */
	context?: Ctx | (() => Ctx);
	/** Options for file creation */
	create?: {
		/**
		 * A function for generating placeholder migration files. Specify to make sure files generated via CLI or using `.create` follow team conventions.
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

/** A callable function for applying or reverting a migration  */
export type MigrationFn<T = unknown> = (params: MigrationParams<T>) => Promise<unknown>;

/**
 * A runnable migration. Represents a migration object with an `up` function which can be called directly, with no arguments, and an optional `down` function to revert it.
 */
export interface RunnableMigration<T> extends MigrationMeta {
	/** The effect of applying the migration */
	up: MigrationFn<T>;
	/** The effect of reverting the migration */
	down?: MigrationFn<T>;
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
	| ((context: T) => Promisable<InputMigrations<T>>);

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

/** Map of eventName -> eventData type, where the keys are the string events that are emitted by an umzug instances, and the values are the payload emitted with the corresponding event. */
export interface UmzugEvents<Ctx> {
	migrating: MigrationParams<Ctx>;
	migrated: MigrationParams<Ctx>;
	reverting: MigrationParams<Ctx>;
	reverted: MigrationParams<Ctx>;
	beforeCommand: { command: string; context: Ctx };
	afterCommand: { command: string; context: Ctx };
}
