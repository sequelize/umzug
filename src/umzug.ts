/* eslint-disable @typescript-eslint/member-ordering */
import { Migration } from './migration';
import path = require('path');
import { EventEmitter } from 'events';
import pMap = require('p-map');
import pEachSeries = require('p-each-series');
import { ToryFolder } from 'tory';

import { JSONStorage, UmzugStorage, isUmzugStorage } from './storage';
import { UmzugExecuteOptions, UmzugConstructorOptions, UmzugEventNames, UmzugRunOptions } from './types';

export class Umzug extends EventEmitter {
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

		const defaultSorting = (a, b) => {
			if (a > b) {
				return 1;
			}

			if (a < b) {
				return -1;
			}

			return 0;
		};

		this.options = {
			storage: Umzug.checkStorage(options.storage ?? new JSONStorage()),
			logging: options.logging ?? false,
			migrationSorting: options.migrationSorting ?? defaultSorting,
			migrations,
		};

		this.storage = this.options.storage;
	}

	private static checkStorage(storage: UmzugStorage): UmzugStorage {
		if (!isUmzugStorage(storage)) {
			const value = typeof storage === 'string' ? storage : typeof storage;
			throw new Error(`Invalid storage option received: ${value}`);
		}

		return storage;
	}

	// #endregion

	// #region EventEmitter explicit implementation typings

	on: (eventName: UmzugEventNames, cb?: (name: string, migration: Migration) => void) => this;
	// {
	// 	return super.on(eventName, cb);
	// }

	addListener: (eventName: UmzugEventNames, cb?: (name: string, migration: Migration) => void) => this;

	removeListener: (eventName: UmzugEventNames, cb?: (name: string, migration: Migration) => void) => this;

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

		const executedFiles = executed.map(migration => migration.file);

		return all.filter(migration => !executedFiles.includes(migration.file));
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
	async up(options: { from?: string; to?: string }): Promise<Migration[]>;

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
	async down(options: { from?: string; to?: string }): Promise<Migration[]>;

	async down(options?: UmzugRunOptions): Promise<Migration[]> {
		const getReversedExecuted = async () => {
			return (await this.executed()).reverse();
		};

		if (!options || Object.keys(options).length === 0) {
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
	log(message: any): void {
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

	private async _checkExecuted(arg: Migration | Migration[]): Promise<boolean> {
		if (Array.isArray(arg)) {
			return (await pMap(arg, async m => this._checkExecuted(m))).every(x => x);
		}

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

	// private async _checkPending(arg: Migration | Migration[]): Promise<boolean> {
	// 	if (Array.isArray(arg)) {
	// 		return (await pMap(arg, async m => this._checkPending(m))).every(x => x);
	// 	}

	// 	const pendingMigrations = await this.pending();
	// 	const found = pendingMigrations.find(m => m.testFileName(arg.file));
	// 	return Boolean(found);
	// }

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
	private async _findMigrationsUntilMatch(to?: string, migrations?: Migration[]): Promise<string[]> {
		if (!Array.isArray(migrations)) {
			migrations = [migrations];
		}

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
