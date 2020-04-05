import { Migration } from './migration';
import { UmzugStorage } from './storages/type-helpers/umzug-storage';

export interface MigrationDefinition {
	/**
	The `default` module option to support the `export default` syntax from ES6 / TypeScript.
	*/
	readonly default?: MigrationDefinition;

	/**
	An async function that performs the task represented by this migration.
	*/
	up(): Promise<any>;

	/**
	An async function that undoes the task represented by this migration.
	*/
	down(): Promise<any>;
}

export interface ShortMigrationOptions {
	/**
	A function that transforms the migrations function (`up` and/or `down`) before it is executed. It receives the migration function and must return another function that works as a migration function in place of it.

	This can be used to modify the behavior of the migration function if necessary.
	*/
	wrap?(fn: () => Promise<any>): (() => Promise<any>);

	/**
	A function that specifies how to get a migration object from a file path. It must return an object with `up` and `down` methods.

	@default require
	*/
	customResolver?(path: string): MigrationDefinition;

	/**
	A function that receives the file path of the migration and returns the name of the migration

	This can be used to remove file extensions for example.

	@default path.basename

	@example filePath => path.parse(filePath).name
	*/
	nameFormatter?(path: string): string;
}

export interface UmzugExecuteOptions {
	/**
	Which migrations to execute (by name).
	*/
	readonly migrations: string[];

	/**
	Which migration method to execute.
	*/
	readonly method: 'up' | 'down';
}

export interface UmzugMigrationParameters {
	/**
	The parameters that will be used to call the `up` and `down` migration functions.

	It can be either an array (which defines the parameters directly), or a function (that will be called right before the migration execution) whose return value is the array of parameters.

	@default []
	*/
	params?: any[] | (() => any[]);
}

export interface UmzugConstructorMigrationOptionsA extends ShortMigrationOptions, UmzugMigrationParameters {
	/**
	The path to the migrations directory, absolute or relative to `process.cwd()`.

	Umzug will automatically retrieve migrations from this directory.

	@default path.resolve(process.cwd(), 'migrations')
	*/
	readonly path?: string;

	/**
	A Regular Expression which determines whether or not a file found in the given path is a migration.

	@default /^\d+[\w-]+\.js$/
	*/
	readonly pattern?: RegExp;

	/**
	Recursively search for migrations in the given folder.

	@default false
	*/
	readonly traverseDirectories?: boolean;
}

export interface UmzugConstructorMigrationOptionsB extends Array<Migration>, UmzugMigrationParameters {}

export type UmzugConstructorMigrationOptions = UmzugConstructorMigrationOptionsA | UmzugConstructorMigrationOptionsB;

export interface UmzugConstructorOptions {
	/**
	The storage.

	Possible values for built-in storages: 'none', 'json', 'mongodb', 'sequelize'.

	You can also provide your own custom storage object. It must adhere to the UmzugStorage interface.

	You can also provide a string which will be used as an argument for `require()`, which should require a class which implements the UmzugStorage interface.
	*/
	readonly storage?: string | UmzugStorage;

	/**
	The logging function.

	A function that gets executed everytime migrations start and have ended.

	Set to `false` to disable.
	*/
	readonly logging?: ((...args: any[]) => void) | false;

	/**
	The options for instantiating the storage. Check the available storages for further details.
	*/
	readonly storageOptions?: any;

	/**
	The options that will setup the detection of migrations.

	This can be either a direct array of Migrations or a set of options which define the auto detection of migrations from a folder.
	*/
	readonly migrations?: UmzugConstructorMigrationOptions;
}
