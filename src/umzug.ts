import Bluebird = require('bluebird');
import fs = require('fs');
import { Migration } from './migration';
import path = require('path');
import jetpack = require('fs-jetpack');
import { EventEmitter } from 'events';
import pMap = require('p-map');
import pEachSeries = require('p-each-series');

import { Storage } from './storages/Storage';
import { JSONStorage } from './storages/JSONStorage';
import { MongoDBStorage } from './storages/MongoDBStorage';
import { SequelizeStorage } from './storages/SequelizeStorage';

function TODO_BLUEBIRD(f) {
	return Bluebird.try(f);
}

export const STORAGES_BY_NAME = {
	none: Storage,
	json: JSONStorage,
	mongodb: MongoDBStorage,
	sequelize: SequelizeStorage
};

export interface UmzugExecuteOptions {
	migrations: string[];
	method: 'up' | 'down';
}

export interface UmzugConstructorMigrationOptions {
	params?: any[] | (() => any[]);
	path?: string;
	pattern?: RegExp;
	traverseDirectories?: boolean;
	wrap?: (unwrappedFunction: Function) => Function;
	customResolver?: (path: string) => any;
	nameFormatter?: (path: string) => string;
}

export interface UmzugConstructorOptions {
	storage?: string | Storage;
	logging?: Function | false;
	storageOptions?: any;
	migrations?: UmzugConstructorMigrationOptions;
}

export class Umzug extends EventEmitter {
	public storage: Storage;

	/**
	 * Constructs Umzug instance.
	 *
	 * @param {Object} [options]
	 * @param {String|Object} [options.storage='json'] - The storage. Possible values:
	 * 'json', 'sequelize', 'mongodb', an argument for `require()`, including absolute paths.
	 * @param {function|false} [options.logging=false] - The logging function.
	 * A function that gets executed every time migrations start and have ended.
	 * @param {Object} [options.storageOptions] - The options for the storage.
	 * Check the available storages for further details.
	 * @param {Object|Array} [options.migrations] - options for loading migration
	 * files, or (advanced) an array of Migration instances
	 * @param {Array} [options.migrations.params] - The params that gets passed to
	 * the migrations. Might be an array or a synchronous function which returns
	 * an array.
	 * @param {String} [options.migrations.path] - The path to the migrations
	 * directory.
	 * @param {RegExp} [options.migrations.pattern] - The pattern that determines
	 * whether or not a file is a migration.
	 * @param {Migration~wrap} [options.migrations.wrap] - A function that
	 * receives and returns the to be executed function. This can be used to
	 * modify the function.
	 * @param {Migration~customResolver} [options.migrations.customResolver] - A
	 * function that specifies how to get a migration object from a path. This
	 * should return an object of the form { up: Function, down: Function }.
	 * Without this defined, a regular javascript import will be performed.
	 * @param {Migration~nameFormatter} [options.migrations.nameFormatter] - A
	 * function that receives the file path of the migration and returns the name
	 * of the migration. This can be used to remove file extensions for example.
	 * @constructs Umzug
	 */
	constructor(public readonly options?: UmzugConstructorOptions) {
		super();

		this.options = {
			storage: 'json',
			storageOptions: {},
			logging: false,
			...options,
		};

		if (this.options.logging && typeof this.options.logging !== 'function') {
			throw new Error('The logging-option should be either a function or false');
		}

		if (!Array.isArray(this.options.migrations)) {
			this.options.migrations = {
				params: [],
				path: path.resolve(process.cwd(), 'migrations'),
				pattern: /^\d+[\w-]+\.js$/,
				traverseDirectories: false,
				wrap: fun => fun,
				...this.options.migrations,
			};
		}

		this.storage = this._getStorage();
	}

	// TODO remove this function
	execute(options?: UmzugExecuteOptions): Bluebird<Migration[]> {
		return TODO_BLUEBIRD(async () => {
			return this.execute2(options);
		});
	}

	/**
	 * Executes given migrations with a given method.
	 */
	private async execute2(options?: UmzugExecuteOptions): Promise<Migration[]> {
		const method = options.method ?? 'up';
		const migrations = await pMap(options.migrations ?? [], name => this._findMigration(name));

		await pEachSeries(migrations, async migration => {
			const name = path.basename(migration.file, path.extname(migration.file));
			let startTime = undefined;

			const executed = await this._checkExecuted2(migration);

			if (!executed || method === 'down') {
				let params = this.options.migrations.params;
				if (typeof params === 'function') {
					params = params();
				}

				if (method === 'up') {
					this.log('== ' + name + ': migrating =======');
					this.emit('migrating', name, migration);
				} else {
					this.log('== ' + name + ': reverting =======');
					this.emit('reverting', name, migration);
				}

				startTime = new Date();

				if (migration[method]) {
					await migration[method].apply(migration, params);
				}
			}

			if (!executed && (method === 'up')) {
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
	 * Lists executed migrations.
	 */
	public executed(): Bluebird<Migration[]> {
		return TODO_BLUEBIRD(async () => {
			return pMap((await this.storage.executed()) as string[], file => new Migration(file, this.options));
		});
	}

	/**
	 * Lists pending migrations.
	 */
	public pending(): Bluebird<Migration[]> {
		return TODO_BLUEBIRD(async () => {
			const all = await this._findMigrations();
			const executed = await this.executed();

			const executedFiles = executed.map(migration => migration.file);

			return all.filter(migration => !executedFiles.includes(migration.file));
		});
	}

	/**
	 * Execute migrations up.
	 *
	 * If options is a migration name (String), it will be executed.
	 * If options is a list of migration names (String[]), them will be executed.
	 * If options is Object:
	 * - { from: 'migration-1', to: 'migration-n' } - execute migrations in range.
	 * - { migrations: [] } - execute migrations in array.
	 *
	 * @param {String|String[]|Object} options
	 * @param {String}     [options.from] - The first migration to execute (exc).
	 * @param {String}     [options.to] - The last migration to execute (inc).
	 * @param {String[]}   [options.migrations] - List of migrations to execute.
	 * @returns {Promise}
	 */
	public up(options): Bluebird<any> {
		return TODO_BLUEBIRD(async () => {
			return this._run2('up', options, this.pending.bind(this));
		});
	}

	/**
	 * Execute migrations down.
	 *
	 * If options is a migration name (String), it will be executed.
	 * If options is a list of migration names (String[]), them will be executed.
	 * If options is Object:
	 * - { from: 'migration-n', to: 'migration-1' } - execute migrations in range.
	 * - { migrations: [] } - execute migrations in array.
	 *
	 * @param {String|String[]|Object} options
	 * @param {String}     [options.from] - The first migration to execute (exc).
	 * @param {String}     [options.to] - The last migration to execute (inc).
	 * @param {String[]}   [options.migrations] - List of migrations to execute.
	 * @returns {Promise}
	 */
	public down(options): Bluebird<any> {
		return TODO_BLUEBIRD(async () => {
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
		});
	}

	_run(method, options, rest?: Function) {
		return TODO_BLUEBIRD(async () => {
			return this._run2(method, options, rest);
		});
	}

	/**
	 * Execute migrations either down or up.
	 *
	 * If options is a migration name (String), it will be executed.
	 * If options is a list of migration names (String[]), them will be executed.
	 * If options is Object:
	 * - { from: 'migration-1', to: 'migration-n' } - execute migrations in range.
	 * - { migrations: [] } - execute migrations in array.
	 *
	 * @param {String} method - Method to run. Either 'up' or 'down'.
	 * @param {String|String[]|Object} options
	 * @param {String}     [options.from] - The first migration to execute (exc).
	 * @param {String}     [options.to] - The last migration to execute (inc).
	 * @param {String[]}   [options.migrations] - List of migrations to execute.
	 * @param {Umzug~rest} [rest] - Function to get migrations in right order.
	 */
	private async _run2(method, options?: string | string[] | { migrations?: string[], from?: string; to?: string }, rest?: Function): Promise<any> {
		if (typeof options === 'string') {
			return this._run2(method, [options]);
		}

		if (Array.isArray(options)) {
			const migrationNames = options;

			const migrations = await pMap(migrationNames, m => this._findMigration(m));

			if (method === 'up') {
				await this._assertPending2(migrations);
			} else {
				await this._assertExecuted2(migrations);
			}

			return this._run2(method, { migrations: options });
		}

		if (options && options.migrations) {
			return this.execute({
				migrations: options.migrations,
				method: method,
			});
		}

		let temp = await rest();

		if (options && options.to) {
			const migration = await this._findMigration(options.to);
			if (method === 'up') {
				await this._assertPending2(migration);
			} else {
				await this._assertExecuted2(migration);
			}
		}

		if (options && options.from) {
			temp = await this._findMigrationsFromMatch(options.from, method);
		}

		const migrationFiles = await this._findMigrationsUntilMatch(options && options.to, temp);

		return this._run2(method, { migrations: migrationFiles });
	}

	/**
	 * Lists pending/executed migrations depending on method from a given
	 * migration excluding it.
	 *
	 * @param {String} from - Migration name to be searched.
	 * @param {String} method - Either 'up' or 'down'. If method is 'up', only
	 * pending migrations will be accepted. Otherwise only executed migrations
	 * will be accepted.
	 */
	private async _findMigrationsFromMatch(from, method): Bluebird<Migration[]> {
		return TODO_BLUEBIRD(async () => {
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
				// now check if they need to be run based on status and method
				if (await this._checkExecuted2(migration)) {
					if (method !== 'up') {
						filteredMigrations.push(migration)
					}
				} else if (method === 'up') {
					filteredMigrations.push(migration)
				}
			}

			return filteredMigrations;
		});
	}

	/**
	 * Pass message to logger if logging is enabled.
	 */
	log(message: any): void {
		if (this.options.logging) {
			this.options.logging(message);
		}
	}

	/**
	 * Try to require and initialize storage.
	 */
	private _getStorage(): Storage {
		if (this.options.storage instanceof Storage) {
			return this.options.storage;
		}

		if (typeof this.options.storage !== 'string') {
			// TODO
			// throw new Error('Unexpected options.storage type.');
			return this.options.storage;
		}

		let StorageClass;
		if (STORAGES_BY_NAME[this.options.storage]) {
			StorageClass = STORAGES_BY_NAME[this.options.storage];
		} else {
			try {
				StorageClass = require(this.options.storage);
			} catch (e) {
				const error2 = new Error(`Unable to resolve the storage: ${this.options.storage}, ${e}`);
				(error2 as any).parent = e;
				throw error2;
			}
		}

		return new StorageClass(this.options.storageOptions);
	}

	/**
	 * Loads all migrations in ascending order.
	 */
	private _findMigrations(migrationPath?: string): Bluebird<Migration[]> {
		return TODO_BLUEBIRD(async () => {
			if (Array.isArray(this.options.migrations)) {
				return this.options.migrations;
			}

			const isRoot = !migrationPath;
			if (isRoot) {
				migrationPath = this.options.migrations.path;
			}

			const shallowFiles = await jetpack.listAsync(migrationPath);

			const migrations: Migration[] =
				(await pMap(shallowFiles, fileName => {
					const filePath = jetpack.path(migrationPath, fileName);

					if (this.options.migrations.traverseDirectories && jetpack.exists(filePath) === 'dir') {
						return this._findMigrations(filePath);
					}

					if (this.options.migrations.pattern.test(fileName)) {
						return Promise.resolve(new Migration(filePath, this.options));
					}

					return Promise.resolve(null);
				}))
				.reduce((a, b) => a.concat(b), []) // flatten the result to an array
				.filter(x => x instanceof Migration); // only care about Migration
			
			if (isRoot) { // only sort if its root
				migrations.sort((a, b) => {
					if (a.file > b.file) {
						return 1;
					} else if (a.file < b.file) {
						return -1;
					} else {
						return 0;
					}
				});
			}

			return migrations;
		});
	}

	/**
	 * Gets a migration with a given name.
	 */
	private _findMigration(name: string): Bluebird<Migration> {
		return TODO_BLUEBIRD(async () => {
			const migrations = await this._findMigrations();
			const found = migrations.find(m => m.testFileName(name));
			if (found) {
				return found;
			}
			throw new Error(`Unable to find migration: ${name}`);
		});
	}

	private async _checkExecuted2(arg: Migration | Migration[]): Promise<boolean> {
		if (Array.isArray(arg)) {
			return (await pMap(arg, m => this._checkExecuted2(m))).every(x => x);
		}
		const executedMigrations = await this.executed();
		const found = executedMigrations.find(m => m.testFileName(arg.file));
		return !!found;
	}

	private async _assertExecuted2(arg: Migration | Migration[]): Promise<void> {
		if (Array.isArray(arg)) {
			await pMap(arg, m => this._assertExecuted2(m));
			return;
		}
		const executedMigrations = await this.executed();
		const found = executedMigrations.find(m => m.testFileName(arg.file));
		if (!found) {
			throw new Error(`Migration was not executed: ${arg.file}`);
		}
	}

	// TODO remove this function
	_wasExecuted(migration): Bluebird<void> {
		return TODO_BLUEBIRD(async () => {
			await this._assertExecuted2(migration);
		});
	}

	// TODO remove this function
	_wereExecuted(migrations): Bluebird<void> {
		return TODO_BLUEBIRD(async () => {
			await this._assertExecuted2(migrations);
		});
	}

	private async _checkPending2(arg: Migration | Migration[]): Promise<boolean> {
		if (Array.isArray(arg)) {
			return (await pMap(arg, m => this._checkPending2(m))).every(x => x);
		}
		const pendingMigrations = await this.pending();
		const found = pendingMigrations.find(m => m.testFileName(arg.file));
		return !!found;
	}

	private async _assertPending2(arg: Migration | Migration[]): Promise<void> {
		if (Array.isArray(arg)) {
			await pMap(arg, m => this._assertPending2(m));
			return;
		}
		const pendingMigrations = await this.pending();
		const found = pendingMigrations.find(m => m.testFileName(arg.file));
		if (!found) {
			throw new Error(`Migration is not pending: ${arg.file}`);
		}
	}

	// TODO remove this function
	_isPending(migration) {
		return TODO_BLUEBIRD(async () => {
			await this._assertPending2(migration);
		});
	}

	// TODO remove this function
	_arePending(migrations) {
		return TODO_BLUEBIRD(async () => {
			await this._assertPending2(migrations);
		});
	}

	/**
	 * Skip migrations in a given migration list after `to` migration.
	 *
	 * @param {String} to - The last one migration to be accepted.
	 * @param {Migration[]} migrations - Migration list to be filtered.
	 */
	private async _findMigrationsUntilMatch(to, _migrations: any): Bluebird<string[]> {
		return TODO_BLUEBIRD(async () => {
			if (!Array.isArray(_migrations)) {
				_migrations = [_migrations];
			}

			const migrations: Migration[] = await Promise.all(_migrations);

			const files = migrations.map(migration => migration.file);
			const temp = files.reduce((acc, migration) => {
				if (acc.add) {
					acc.migrations.push(migration);

					if (to && (migration.indexOf(to) === 0)) {
						// Stop adding the migrations once the final migration
						// has been added.
						acc.add = false;
					}
				}

				return acc;
			}, { migrations: [], add: true });

			return temp.migrations;
		});
	}
}
