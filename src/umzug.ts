import { Migration } from './migration';
import path = require('path');
import { EventEmitter } from 'events';
import pMap = require('p-map');
import pEachSeries = require('p-each-series');
import { ToryFolder } from 'tory';

import { JSONStorage, UmzugStorage, isUmzugStorage } from './storage';
import { UmzugExecuteOptions, UmzugConstructorOptions, UmzugEventNames, UmzugRunOptions } from './types';

export class UmzugLegacy extends EventEmitter {
	public readonly options: Required<UmzugConstructorOptions>;
	public storage: UmzugStorage;

	// #region Constructor

	constructor(options?: UmzugConstructorOptions) {
		super();
		options = options ?? {};

		if (options.logging && typeof options.logging !== 'function') {
			throw new Error('The logging-option should be either a function or false');
		}

		let migrations;
		if (Array.isArray(options.migrations)) {
			migrations = options.migrations;
		} else {
			migrations = {
				params: [],
				path: path.resolve(process.cwd(), 'migrations'),
				pattern: /^\d+[\w-]+\.js$/,
				traverseDirectories: false,
				wrap: (fn: () => Promise<any>) => fn,
				...options.migrations,
			};
		}

		const defaultSorting = (a: string, b: string) => a.localeCompare(b);

		this.options = {
			storage: options.storage ?? new JSONStorage(),
			logging: options.logging ?? false,
			migrationSorting: options.migrationSorting ?? defaultSorting,
			migrations,
		};

		this.storage = this.options.storage;

		UmzugLegacy.checkStorage(this.storage);
	}

	private static checkStorage(storage: UmzugStorage) {
		if (!isUmzugStorage(storage)) {
			const value = typeof storage === 'string' ? storage : typeof storage;
			throw new Error(`Invalid storage option received: ${value}`);
		}
	}

	// #endregion

	// #region EventEmitter explicit implementation typings

	on(eventName: UmzugEventNames, cb?: (name: string, migration: Migration) => void): this {
		return super.on(eventName, cb);
	}

	addListener(eventName: UmzugEventNames, cb?: (name: string, migration: Migration) => void): this {
		return super.addListener(eventName, cb);
	}

	removeListener(eventName: UmzugEventNames, cb?: (name: string, migration: Migration) => void): this {
		return super.removeListener(eventName, cb);
	}

	// #endregion

	/**
	Executes given migrations with a given method.
	*/
	async execute(options?: UmzugExecuteOptions): Promise<Migration[]> {
		const method = options.method ?? 'up';
		const migrations = await pMap(options.migrations ?? [], async name => this._findMigration(name));

		await pEachSeries(migrations, async migration => {
			const name = path.basename(migration.file, path.extname(migration.file));
			let startTime;

			const executed = await this._checkExecuted(migration);

			if (!executed || method === 'down') {
				let { params } = this.options.migrations;
				if (typeof params === 'function') {
					params = params();
				}

				params = params || [];

				if (method === 'up') {
					this.log('== ' + name + ': migrating =======');
					this.emit('migrating', name, migration);
				} else {
					this.log('== ' + name + ': reverting =======');
					this.emit('reverting', name, migration);
				}

				startTime = new Date();

				if (migration[method]) {
					await migration[method](...params);
				}
			}

			if (!executed && method === 'up') {
				await this.storage.logMigration(migration.file);
			} else if (method === 'down') {
				await this.storage.unlogMigration(migration.file);
			}

			// TODO uncomment this
			// if (startTime === undefined) {
			// 	throw new Error('Why is a duration of NaN acceptable??');
			// }

			const duration = (((new Date() as any) - startTime) / 1000).toFixed(3);

			if (method === 'up') {
				this.log(`== ${name}: migrated (${duration}s)\n`);
				this.emit('migrated', name, migration);
			} else {
				this.log(`== ${name}: reverted (${duration}s)\n`);
				this.emit('reverted', name, migration);
			}
		});

		return migrations;
	}

	/**
	Lists executed migrations.
	*/
	async executed(): Promise<Migration[]> {
		// TODO remove this forced type-cast
		return pMap(await this.storage.executed(), file => new Migration(file, this.options as any));
	}

	/**
	Lists pending migrations.
	*/
	async pending(): Promise<Migration[]> {
		const all = await this._findMigrations();
		const executed = await this.executed();

		const executedFiles = new Set(executed.map(migration => migration.file));

		return all.filter(migration => !executedFiles.has(migration.file));
	}

	/**
	Executes the next pending migration.
	*/
	async up(): Promise<Migration[]>;

	/**
	Executes the given migration (by name).
	*/
	async up(migrationsName: string): Promise<Migration[]>;

	/**
	Executes the given migrations (by name).
	*/
	async up(migrationsNames: string[] | { migrations: string[] }): Promise<Migration[]>;

	/**
	Executes the migrations in the given interval. The interval excludes `from` and includes `to`.

	If `from` is omitted, takes from the beginning.
	If `to` is omitted, takes to the end.
	*/
	async up(options: { from?: string; to?: string | 0 }): Promise<Migration[]>;

	async up(options?: UmzugRunOptions): Promise<Migration[]> {
		return this._run('up', options, this.pending.bind(this));
	}

	/**
	Undoes the last executed migration.
	*/
	async down(): Promise<Migration[]>;

	/**
	Undoes the given migration (by name).
	*/
	async down(migrationsName: string): Promise<Migration[]>;

	/**
	Undoes the given migrations (by name).
	*/
	async down(migrationsNames: string[] | { migrations: string[] }): Promise<Migration[]>;

	/**
	Undoes the migrations in the given interval. The interval excludes `from` and includes `to`.

	If `from` is omitted, takes from the beginning.
	If `to` is omitted, takes to the end.
	*/
	async down(options: { from?: string; to?: string | 0 }): Promise<Migration[]>;

	async down(options?: UmzugRunOptions): Promise<Migration[]> {
		const getReversedExecuted = async () => {
			return (await this.executed()).reverse();
		};

		// todo [>=3.0.0] restrict what _run receives, this check is brittle
		// it's ok for this method to have pretty ambiguous inputs since it's public
		// but _run is private so we should be more precise about what we pass to it.
		if (!options || Object.keys(options).every(k => typeof options[k] === 'undefined')) {
			const migrations = await getReversedExecuted();
			if (migrations[0]) {
				return this.down(migrations[0].file);
			}

			return [];
		}

		return this._run('down', options, getReversedExecuted);
	}

	/**
	Pass message to logger if logging is enabled.
	*/
	log(message: unknown): void {
		if (this.options.logging) {
			this.options.logging(message);
		}
	}

	private async _run(
		method: 'up' | 'down',
		options?: UmzugRunOptions,
		rest?: () => Promise<Migration[]>
	): Promise<Migration[]> {
		if (typeof options === 'string') {
			return this._run(method, [options]);
		}

		if (Array.isArray(options)) {
			const migrationNames = options;

			const migrations = await pMap(migrationNames, async m => this._findMigration(m));

			if (method === 'up') {
				await this._assertPending(migrations);
			} else {
				await this._assertExecuted(migrations);
			}

			return this._run(method, { migrations: options });
		}

		if (options?.migrations) {
			return this.execute({
				migrations: options.migrations,
				method,
			});
		}

		let migrationList = await rest();

		if (options?.to) {
			const migration = await this._findMigration(options.to);
			if (method === 'up') {
				await this._assertPending(migration);
			} else {
				await this._assertExecuted(migration);
			}
		}

		if (options?.from) {
			migrationList = await this._findMigrationsFromMatch(options.from, method);
		}

		const migrationFiles = await this._findMigrationsUntilMatch(options?.to, migrationList);

		return this._run(method, { migrations: migrationFiles });
	}

	/**
	Lists pending/executed migrations depending on method from a given migration (excluding itself).
	*/
	private async _findMigrationsFromMatch(from, method): Promise<Migration[]> {
		// We'll fetch all migrations and work our way from start to finish
		let migrations = await this._findMigrations();

		let found = false;

		migrations = migrations.filter(migration => {
			if (migration.testFileName(from)) {
				found = true;
				return false;
			}

			return found;
		});

		const filteredMigrations: Migration[] = [];

		for (const migration of migrations) {
			// Now check if they need to be run based on status and method
			// eslint-disable-next-line no-await-in-loop
			if (await this._checkExecuted(migration)) {
				if (method !== 'up') {
					filteredMigrations.push(migration);
				}
			} else if (method === 'up') {
				filteredMigrations.push(migration);
			}
		}

		return filteredMigrations;
	}

	/**
	Loads all migrations in ascending order.
	*/
	private async _findMigrations(): Promise<Migration[]> {
		if (Array.isArray(this.options.migrations)) {
			return this.options.migrations.slice().sort((a, b) => this.options.migrationSorting(a.file, b.file));
		}

		const migrationOptions = this.options.migrations;

		const migrationsFolder = new ToryFolder(migrationOptions.path);

		const migrationsFileIterable = migrationOptions.traverseDirectories
			? migrationsFolder.toDFSFilesRecursiveIterable()
			: migrationsFolder.getFiles();

		const migrationFiles = [...migrationsFileIterable].filter(file => {
			return migrationOptions.pattern.test(file.name);
		});

		const migrations = migrationFiles.map(file => new Migration(file.absolutePath, this.options as any));

		migrations.sort((a, b) => this.options.migrationSorting(a.file, b.file));

		return migrations;
	}

	/**
	Gets a migration with a given name.
	*/
	private async _findMigration(name: string): Promise<Migration> {
		const migrations = await this._findMigrations();
		const found = migrations.find(m => m.testFileName(name));
		if (found) {
			return found;
		}

		throw new Error(`Unable to find migration: ${name}`);
	}

	private async _checkExecuted(arg: Migration): Promise<boolean> {
		const executedMigrations = await this.executed();
		const found = executedMigrations.find(m => m.testFileName(arg.file));
		return Boolean(found);
	}

	private async _assertExecuted(arg: Migration | Migration[]): Promise<void> {
		if (Array.isArray(arg)) {
			await pMap(arg, async m => this._assertExecuted(m));
			return;
		}

		const executedMigrations = await this.executed();
		const found = executedMigrations.find(m => m.testFileName(arg.file));
		if (!found) {
			throw new Error(`Migration was not executed: ${arg.file}`);
		}
	}

	private async _assertPending(arg: Migration | Migration[]): Promise<void> {
		if (Array.isArray(arg)) {
			await pMap(arg, async m => this._assertPending(m));
			return;
		}

		const pendingMigrations = await this.pending();
		const found = pendingMigrations.find(m => m.testFileName(arg.file));
		if (!found) {
			throw new Error(`Migration is not pending: ${arg.file}`);
		}
	}

	/**
	Skip migrations in a given migration list after `to` migration.
	*/
	private async _findMigrationsUntilMatch(to: string | 0, migrations: Migration[]): Promise<string[]> {
		const files = migrations.map(migration => migration.file);

		if (!to) {
			return files;
		}

		const result: string[] = [];

		for (const file of files) {
			result.push(file);
			if (file.startsWith(to)) {
				break;
			}
		}

		return result;
	}
}

import * as glob from 'glob';
import { basename, extname } from 'path';

export interface MigrationContainer {
	up: () => Promise<unknown>;
	down?: () => Promise<unknown>;
}

export type MigrationList = Array<{ name: string; path?: string; migration: MigrationContainer }>;

export type InputMigrations<T> =
	| {
			/**
			 * A glob string for migration files. Can also be in the format `['path/to/migrations/*.js', {cwd: 'some/base/dir', ignore: '**ignoreme.js' }]`
			 * See https://npmjs.com/package/glob for more details on the glob format - this package is used internally.
			 */
			glob: string | [string, { cwd?: string; ignore?: string | string[] }];
			/** Will be supplied to every migration function. Can be a database client, for example */
			context?: T;
			/** A function which returns `up` and `down` function, from a migration name, path and context. */
			resolve?: Resolver<T>;
	  }
	| MigrationList
	| ((context: T) => MigrationList);

export interface GetUmzugParams<Storage extends UmzugStorage, T = never> {
	migrations: InputMigrations<T>;
	storage?: Storage;
	context?: T;
	logging?: ((...args: any[]) => void) | false;
}

/** A function which returns `up` and `down` function, from a migration name, path and context. */
export type Resolver<T> = (params: { path: string; name: string; context: T }) => MigrationContainer;

// todo [>=3.0.0] document how to migrate to v3, which has a breaking change - it passes in path, name, context where v2 passed in context only.
export const defaultResolver: Resolver<unknown> = ({ path: filepath, name, context }) => {
	const ext = path.extname(filepath);
	const canRequire = ext === '.js' || ext in require.extensions;
	if (!canRequire) {
		const errorParts = [
			`No resolver specified for file ${filepath}.`,
			ext === '.ts' &&
				"Calling `require('ts-node/register')` will allow usage of the default resolver for typescript files.",
			`See docs for guidance on how to write a custom resolver.`,
		];
		throw new Error(errorParts.filter(Boolean).join(' '));
	}

	const getMigration = () => require(filepath);

	return {
		up: async () => getMigration().up({ path: filepath, name, context }) as unknown,
		down: async () => getMigration().up({ path: filepath, name, context }) as unknown,
	};
};

export type MigrationType<U extends Umzug2<any>> = (params: {
	name: string;
	path: string;
	context: U extends Umzug2<infer C> ? C : never;
}) => Promise<unknown>;

export class Umzug2<Context> extends UmzugLegacy {
	migrations: () => Promise<MigrationList>;

	constructor(params: GetUmzugParams<UmzugStorage, Context>) {
		const migrationList = getMigrations(params.migrations, params.context);

		super({
			logging: params.logging,
			storage: params.storage,
			migrations: migrationList.map(({ name, migration }) => {
				const resolved = { up: migration.up, down: migration.down || Promise.resolve };
				return new Migration(name, { migrations: { customResolver: () => resolved } });
			}),
			// todo: disable migration sorting when passing in a list directly - users can sort it themselves if they want to.
			// or, remove it completely in favour of this API in v3 RC.
			// For now, this hack passes a custom sorting function that respects the order of the resolved list
			migrationSorting: (() => {
				const indexes = new Map(migrationList.map((m, i) => [m.name, i]));
				const indexOf = (name: string) => indexes.get(name) ?? -1;
				return (a: string, b: string) => indexOf(a) - indexOf(b);
			})(),
		});

		this.migrations = async () => migrationList;
	}
}

export const getMigrations = <T>(inputMigrations: InputMigrations<T>, context?: T): MigrationList => {
	if (Array.isArray(inputMigrations)) {
		return inputMigrations;
	}

	if (typeof inputMigrations === 'function') {
		return inputMigrations(context);
	}

	const fileGlob = inputMigrations.glob;
	const [globString, globOptions]: Parameters<typeof glob.sync> = Array.isArray(fileGlob) ? fileGlob : [fileGlob];

	const resolver: Resolver<T> = inputMigrations.resolve || defaultResolver;

	// todo [>=3.0.0] deprecate the old `new Umzug(...)` usage and make this "lazier". It'd be good if
	// we could hold off on actually querying the filesystem via glob.sync. Will require a refactor of
	// the main `Umzug` class though, so should wait until this API has been proven out.
	const files = glob.sync(globString, { ...globOptions, absolute: true }).map(p => path.resolve(p));
	return files.map(filepath => {
		const name = basename(filepath, extname(filepath));
		return {
			name,
			path: filepath,
			migration: resolver({ context, path: filepath, name }),
		};
	});
};
