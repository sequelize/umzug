import Bluebird from 'bluebird';
import fs from 'fs';
import Migration from './migration';
import path from 'path';
import { EventEmitter } from 'events';

import Storage from './storages/Storage';
import JSONStorage from './storages/JSONStorage';
import MongoDBStorage from './storages/MongoDBStorage';
import SequelizeStorage from './storages/SequelizeStorage';

module.exports = class Umzug extends EventEmitter {
  /**
  * Constructs Umzug instance.
  *
  * @param {Object} [options]
  * @param {String} [options.storage='json'] - The storage. Possible values:
  * 'json', 'sequelize', an argument for `require()`, including absolute paths.
  * @param {function|false} [options.logging=false] - The logging function.
  * A function that gets executed every time migrations start and have ended.
  * @param {String} [options.upName='up'] - The name of the positive method
  * in migrations.
  * @param {String} [options.downName='down'] - The name of the negative method
  * in migrations.
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
  * @constructs Umzug
  */
  constructor (options = {}) {
    super();

    this.options = {
      storage: 'json',
      storageOptions: {},
      logging: false,
      upName: 'up',
      downName: 'down',
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

    this.storage = this._initStorage();
  }

  /**
  * Executes given migrations with a given method.
  *
  * @param {Object}   [options]
  * @param {String[]} [options.migrations=[]]
  * @param {String}   [options.method='up']
  * @returns {Promise}
  */
  execute (options = {}) {
    options = {
      migrations: [],
      method: 'up',
      ...options,
    };

    return Bluebird
      .map(options.migrations, (migration) => this._findMigration(migration))
      .then((migrations) => ({
        ...options,
        migrations,
      }))
      .then((options) => Bluebird.each(options.migrations, (migration) => {
        const name = path.basename(migration.file, path.extname(migration.file));
        let startTime;
        return this
          ._wasExecuted(migration)
          .catch(() => false)
          .then((executed) => (typeof executed === 'undefined') ? true : executed)
          .tap((executed) => {
            if (!executed || (options.method === 'down')) {
              const fun = (migration[options.method] || Bluebird.resolve);
              let params = this.options.migrations.params;

              if (typeof params === 'function') {
                params = params();
              }

              if (options.method === 'up') {
                this.log('== ' + name + ': migrating =======');
                this.emit('migrating', name, migration);
              } else {
                this.log('== ' + name + ': reverting =======');
                this.emit('reverting', name, migration);
              }

              startTime = new Date();

              return fun.apply(migration, params);
            }
          })
          .then((executed) => {
            if (!executed && (options.method === 'up')) {
              return Bluebird.resolve(this.storage.logMigration(migration.file));
            } else if (options.method === 'down') {
              return Bluebird.resolve(this.storage.unlogMigration(migration.file));
            }
          })
          .tap(() => {
            const duration = ((new Date() - startTime) / 1000).toFixed(3);
            if (options.method === 'up') {
              this.log('== ' + name + ': migrated (' + duration + 's)\n');
              this.emit('migrated', name, migration);
            } else {
              this.log('== ' + name + ': reverted (' + duration + 's)\n');
              this.emit('reverted', name, migration);
            }
          });
      }));
  }

  /**
  * Lists executed migrations.
  *
  * @returns {Promise.<Migration>}
  */
  executed () {
    return Bluebird.resolve(this.storage.executed()).map((file) => new Migration(file));
  }

  /**
  * Lists pending migrations.
  *
  * @returns {Promise.<Migration[]>}
  */
  pending () {
    return this
      ._findMigrations()
      .then((all) => Bluebird.join(all, this.executed()))
      .spread((all, executed) => {
        const executedFiles = executed.map((migration) => migration.file);

        return all.filter((migration) => !executedFiles.includes(migration.file));
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
    return this._run('up', options, () => this.pending());
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
    const getExecuted = () => this.executed().then((migrations) => migrations.reverse());

    if (typeof options === 'undefined' || Object.keys(options).length === 0) {
      return getExecuted().then((migrations) => migrations[0]
        ? this.down(migrations[0].file)
        : Bluebird.resolve([]));
    }
    return this._run('down', options, () => getExecuted());
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
  _run (method, options, rest) {
    if (typeof options === 'string') {
      return this._run(method, [ options ]);
    } else if (Array.isArray(options)) {
      return Bluebird.resolve(options)
        .map((migration) => this._findMigration(migration))
        .then((migrations) => method === 'up'
          ? this._arePending(migrations)
          : this._wereExecuted(migrations))
        .then(() => this._run(method, { migrations: options }));
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
    }
    return rest()
      .then((migrations) => {
        let result = Bluebird.resolve();

        if (options.to) {
          result = result
            .then(() =>
              // There must be a migration matching to options.to...
              this._findMigration(options.to)
            )
            .then((migration) =>
              // ... and it must be pending/executed.
              method === 'up'
                ? this._isPending(migration)
                : this._wasExecuted(migration)
            );
        }

        return result.then(() => migrations);
      })
      .then((migrations) => {
        if (options.from) {
          return this._findMigrationsFromMatch(options.from, method);
        }
        return migrations;
      })
      .then((migrations) => this._findMigrationsUntilMatch(options.to, migrations))
      .then((migrationFiles) => this._run(method, { migrations: migrationFiles }));
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
      .filter((fromMigration) =>
      // now check if they need to be run based on status and method
        this._wasExecuted(fromMigration)
          .then(() => method !== 'up', () => method === 'up')
      );
  }

  /**
  * Pass message to logger if logging is enabled.
  *
  * @param {*} message - Message to be logged.
  */
  log (message) {
    if (this.options.logging) {
      this.options.logging(message);
    }
  }

  /**
  * Try to require and initialize storage.
  *
  * @returns {*|SequelizeStorage|JSONStorage|Storage}
  * @private
  */
  _initStorage () {
    if (typeof this.options.storage !== 'string') {
      return this.options.storage;
    }

    let StorageClass;
    try {
      StorageClass = this._getStorageClass();
    } catch (e) {
      throw new Error('Unable to resolve the storage: ' + this.options.storage + ', ' + e);
    }

    const storage = new StorageClass(this.options.storageOptions);

    return storage;
  }

  _getStorageClass () {
    switch (this.options.storage) {
      case 'none': return Storage;
      case 'json': return JSONStorage;
      case 'mongodb': return MongoDBStorage;
      case 'sequelize': return SequelizeStorage;
      default: return require(this.options.storage);
    }
  }

  /**
    * Loads all migrations in ascending order.
    *
    * @returns {Promise.<Migration[]>}
    * @private
    */
  _findMigrations (migrationPath) {
    if (Array.isArray(this.options.migrations)) {
      return Bluebird.resolve(this.options.migrations);
    }
    const isRoot = !migrationPath;
    if (isRoot) {
      migrationPath = this.options.migrations.path;
    }
    return Bluebird
      .promisify(fs.readdir)(migrationPath)
      .map((file) => {
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
        this.log('File: ' + file + ' does not match pattern: ' + this.options.migrations.pattern);
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
            }
            if (a.file < b.file) {
              return -1;
            }
            return 0;
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
      .map((migration) => this._wasExecuted(migration));
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
      .map((migration) => this._isPending(migration));
  }

  /**
    * Skip migrations in a given migration list after `to` migration.
    *
    * @param {String} to - The last one migration to be accepted.
    * @param {Migration[]} migrations - Migration list to be filtered.
    * @returns {Promise.<String>} - List of migrations before `to`.
    * @private
    */
  _findMigrationsUntilMatch (to, migrations) {
    return Bluebird.resolve(migrations)
      .map((migration) => migration.file)
      .reduce((acc, migration) => {
        if (acc.add) {
          acc.migrations.push(migration);

          if (to && migration.startsWith(to)) {
            // Stop adding the migrations once the final migration
            // has been added.
            acc.add = false;
          }
        }

        return acc;
      }, { migrations: [], add: true })
      .get('migrations');
  }
};
