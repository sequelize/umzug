import Bluebird = require('bluebird');
import fs = require('fs');
import { Migration } from './migration';
import path = require('path');
import jetpack = require('fs-jetpack');
import { EventEmitter } from 'events';
import pMap = require('p-map');

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

	/**
	 * Executes given migrations with a given method.
	 *
	 * @param {Object}   [options]
	 * @param {String[]} [options.migrations=[]]
	 * @param {String}   [options.method='up']
	 * @returns {Promise}
	 */
	execute (options?: UmzugExecuteOptions) {
		const self = this;

		options = {
			migrations: [],
			method: 'up',
			...options,
		};

		return Bluebird
			.map(options.migrations, (migration) => self._findMigration(migration))
			.then((migrations) => ({
				...options,
				migrations,
			}))
			.then((options) => Bluebird.each(options.migrations, (migration) => {
				const name = path.basename(migration.file, path.extname(migration.file));
				let startTime;
				return self
					._wasExecuted(migration)
					.catch(() => false)
					.then((executed) => (typeof executed === 'undefined') ? true : executed)
					.tap((executed) => {
						if (!executed || (options.method === 'down')) {
							const fun = (migration[options.method] || Bluebird.resolve);
							let params = self.options.migrations.params;

							if (typeof params === 'function') {
								params = params();
							}

							if (options.method === 'up') {
								self.log('== ' + name + ': migrating =======');
								self.emit('migrating', name, migration);
							} else {
								self.log('== ' + name + ': reverting =======');
								self.emit('reverting', name, migration);
							}

							startTime = new Date();

							return fun.apply(migration, params);
						}
					})
					.then((executed) => {
						if (!executed && (options.method === 'up')) {
							return Bluebird.resolve(self.storage.logMigration(migration.file));
						} else if (options.method === 'down') {
							return Bluebird.resolve(self.storage.unlogMigration(migration.file));
						}
					})
					.tap(() => {
						const duration = (((new Date() as any) - startTime) / 1000).toFixed(3);
						if (options.method === 'up') {
							self.log('== ' + name + ': migrated (' + duration + 's)\n');
							self.emit('migrated', name, migration);
						} else {
							self.log('== ' + name + ': reverted (' + duration + 's)\n');
							self.emit('reverted', name, migration);
						}
					});
			}));
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
	up (options) {
		return this._run('up', options, this.pending.bind(this));
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
	down (options) {
		const getExecuted = function () {
			return this.executed().bind(this).then((migrations) => migrations.reverse());
		}.bind(this);

		if (typeof options === 'undefined' || !Object.keys(options).length) {
			return getExecuted().bind(this).then(function (migrations) {
				return migrations[0]
					? this.down(migrations[0].file)
					: Bluebird.resolve([]);
			});
		} else {
			return this._run('down', options, getExecuted.bind(this));
		}
	}

	/**
	 * Callback function to get migrations in right order.
	 *
	 * @callback Umzug~rest
	 * @return {Promise.<Migration[]>}
	 */

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
	 * @returns {Promise}
	 * @private
	 */
	_run (method, options, rest?: Function) {
		if (typeof options === 'string') {
			return this._run(method, [ options ]);
		} else if (Array.isArray(options)) {
			return Bluebird.resolve(options).bind(this)
				.map(function (migration) {
					return this._findMigration(migration);
				})
				.then(function (migrations) {
					return method === 'up'
						? this._arePending(migrations)
						: this._wereExecuted(migrations);
				})
				.then(function () {
					return this._run(method, { migrations: options });
				});
		}

		options = {
			to: null,
			from: null,
			migrations: null,
			...options || {},
		};

		if (options.migrations) {
			return this.execute({
				migrations: options.migrations,
				method: method,
			});
		} else {
			return rest().bind(this)
				.then(function (migrations) {
					let result = Bluebird.resolve().bind(this);

					if (options.to) {
						result = result
							.then(function () {
								// There must be a migration matching to options.to...
								return this._findMigration(options.to);
							})
							.then(function (migration) {
								// ... and it must be pending/executed.
								return method === 'up'
									? this._isPending(migration)
									: this._wasExecuted(migration);
							});
					}

					return result.then(() => Bluebird.resolve(migrations));
				})
				.then(function (migrations) {
					if (options.from) {
						return this._findMigrationsFromMatch(options.from, method);
					} else {
						return migrations;
					}
				})
				.then(function (migrations) {
					return this._findMigrationsUntilMatch(options.to, migrations);
				})
				.then(function (migrationFiles) {
					return this._run(method, { migrations: migrationFiles });
				});
		}
	}

	/**
	 * Lists pending/executed migrations depending on method from a given
	 * migration excluding it.
	 *
	 * @param {String} from - Migration name to be searched.
	 * @param {String} method - Either 'up' or 'down'. If method is 'up', only
	 * pending migrations will be accepted. Otherwise only executed migrations
	 * will be accepted.
	 * @returns {Promise.<Migration[]>}
	 * @private
	 */
	_findMigrationsFromMatch (from, method) {
		// We'll fetch all migrations and work our way from start to finish
		return this._findMigrations()
			.bind(this)
			.then((migrations) => {
				let found = false;
				return migrations.filter((migration) => {
					if (migration.testFileName(from)) {
						found = true;
						return false;
					}
					return found;
				});
			})
			.filter(function (fromMigration) {
				// now check if they need to be run based on status and method
				return this._wasExecuted(fromMigration)
					.then(() => {
						if (method === 'up') {
							return false;
						} else {
							return true;
						}
					})
					.catch(() => {
						if (method === 'up') {
							return true;
						} else {
							return false;
						}
					});
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
	 *
	 * @returns {Promise.<Migration[]>}
	 * @private
	 */
	_findMigrations (migrationPath?: string) {
		if (Array.isArray(this.options.migrations)) {
			return Bluebird.resolve(this.options.migrations);
		}
		const isRoot = !migrationPath;
		if (isRoot) {
			migrationPath = this.options.migrations.path;
		}
		return Bluebird
			.promisify(fs.readdir)(migrationPath)
			.bind(this)
			.map(function (file) {
				const filePath = path.resolve(migrationPath, file);
				if (this.options.migrations.traverseDirectories) {
					if (fs.lstatSync(filePath).isDirectory()) {
						return this._findMigrations(filePath)
							.then((migrations) => migrations);
					}
				}
				if (this.options.migrations.pattern.test(file)) {
					return new Migration(filePath, this.options);
				}
				return file;
			})
			.reduce((a, b) => a.concat(b), []) // flatten the result to an array
			.filter((file) =>
				file instanceof Migration // only care about Migration
			)
			.then((migrations) => {
				if (isRoot) { // only sort if its root
					return migrations.sort((a, b) => {
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
	 *
	 * @param {String} needle - Name of the migration.
	 * @returns {Promise.<Migration>}
	 * @private
	 */
	_findMigration (needle) {
		return this
			._findMigrations()
			.then((migrations) => migrations.filter((migration) => migration.testFileName(needle))[0])
			.then((migration) => {
				if (migration) {
					return migration;
				} else {
					return Bluebird.reject(new Error('Unable to find migration: ' + needle));
				}
			});
	}

	/**
	 * Checks if migration is executed. It will success if and only if there is
	 * an executed migration with a given name.
	 *
	 * @param {String} _migration - Name of migration to be checked.
	 * @returns {Promise}
	 * @private
	 */
	_wasExecuted (_migration) {
		return this.executed().filter((migration) => migration.testFileName(_migration.file)).then((migrations) => {
			if (migrations[0]) {
				return Bluebird.resolve();
			} else {
				return Bluebird.reject(new Error('Migration was not executed: ' + _migration.file));
			}
		});
	}

	/**
	 * Checks if a list of migrations are all executed. It will success if and
	 * only if there is an executed migration for each given name.
	 *
	 * @param {String[]} migrationNames - List of migration names to be checked.
	 * @returns {Promise}
	 * @private
	 */
	_wereExecuted (migrationNames) {
		return Bluebird
			.resolve(migrationNames)
			.bind(this)
			.map(function (migration) {
				return this._wasExecuted(migration);
			});
	}

	/**
	 * Checks if migration is pending. It will success if and only if there is
	 * a pending migration with a given name.
	 *
	 * @param {String} _migration - Name of migration to be checked.
	 * @returns {Promise}
	 * @private
	 */
	_isPending (_migration) {
		return this.pending().filter((migration) => migration.testFileName(_migration.file)).then((migrations) => {
			if (migrations[0]) {
				return Bluebird.resolve();
			} else {
				return Bluebird.reject(new Error('Migration is not pending: ' + _migration.file));
			}
		});
	}

	/**
	 * Checks if a list of migrations are all pending. It will success if and only
	 * if there is a pending migration for each given name.
	 *
	 * @param {String[]} migrationNames - List of migration names to be checked.
	 * @returns {Promise}
	 * @private
	 */
	_arePending (migrationNames) {
		return Bluebird
			.resolve(migrationNames)
			.bind(this)
			.map(function (migration) {
				return this._isPending(migration);
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
