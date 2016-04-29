'use strict';

var _            = require('lodash');
var Bluebird     = require('bluebird');
var fs           = require('fs');
var Migration    = require('./lib/migration');
var path         = require('path');
var redefine     = require('redefine');
var EventEmitter = require('events').EventEmitter;

/**
 * @class Umzug
 * @extends EventEmitter
 */
var Umzug = module.exports = redefine.Class(/** @lends Umzug.prototype */ {
  extend: EventEmitter,

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
   * @param {Object} [options.migrations] -
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
   * @constructs Umzug
   */
  constructor: function (options) {
    this.options = _.assign({
      storage:        'json',
      storageOptions: {},
      logging:        false,
      upName:         'up',
      downName:       'down'
    }, options);

    if (this.options.logging && !_.isFunction(this.options.logging)) {
      throw new Error('The logging-option should be either a function or false');
    }

    this.options.migrations = _.assign({
      params:  [],
      path:    path.resolve(process.cwd(), 'migrations'),
      pattern: /^\d+[\w-]+\.js$/,
      wrap:    function (fun) { return fun; }
    }, this.options.migrations);

    this.storage = this._initStorage();

    EventEmitter.call(this);
  },

  /**
   * Executes given migrations with a given method.
   *
   * @param {Object}   [options]
   * @param {String[]} [options.migrations=[]]
   * @param {String}   [options.method='up']
   * @returns {Promise}
   */
  execute: function (options) {
    var self = this;

    options = _.assign({
      migrations: [],
      method:     'up'
    }, options || {});

    return Bluebird
      .map(options.migrations, function (migration) {
        return self._findMigration(migration);
      })
      .then(function (migrations) {
        return _.assign({}, options, { migrations: migrations });
      })
      .then(function (options) {
        return Bluebird.each(options.migrations, function (migration) {
          var name = path.basename(migration.file, path.extname(migration.file));
          var startTime;
          return self
            ._wasExecuted(migration)
            .catch(function () {
              return false;
            })
            .then(function (executed) {
              return (typeof executed === 'undefined') ? true : executed;
            })
            .tap(function (executed) {
              if (!executed || (options.method === 'down')) {
                var fun    = (migration[options.method] || Bluebird.resolve);
                var params = self.options.migrations.params;

                if (typeof params === 'function') {
                  params = params();
                }

                if (options.method === 'up') {
                  self.log("== " + name + ": migrating =======");
                  self.emit('migrating', name, migration);
                } else {
                  self.log("== " + name + ": reverting =======");
                  self.emit('reverting', name, migration);
                }

                startTime = new Date();

                return fun.apply(migration, params);
              }
            })
            .then(function (executed) {
              if (!executed && (options.method === 'up')) {
                return Bluebird.resolve(self.storage.logMigration(migration.file));
              } else if (options.method === 'down') {
                return Bluebird.resolve(self.storage.unlogMigration(migration.file));
              }
            })
            .tap(function () {
              var duration = ((new Date() - startTime) / 1000).toFixed(3);
              if (options.method === 'up') {
                self.log("== " + name + ": migrated (" + duration +  "s)\n");
                self.emit('migrated', name, migration);
              } else {
                self.log("== " + name + ": reverted (" + duration +  "s)\n");
                self.emit('reverted', name, migration);
              }
            });
        });
      });
  },

  /**
   * Lists executed migrations.
   *
   * @returns {Promise.<Migration>}
   */
  executed: function () {
    return Bluebird.resolve(this.storage.executed()).bind(this).map(function (file) {
      return new Migration(file);
    });
  },

  /**
   * Lists pending migrations.
   *
   * @returns {Promise.<Migration[]>}
   */
  pending: function () {
    return this
      ._findMigrations()
      .bind(this)
      .then(function (all) {
        return Bluebird.join(all, this.executed());
      })
      .spread(function (all, executed) {
        var executedFiles = executed.map(function (migration) {
          return migration.file;
        });

        return all.filter(function (migration) {
          return executedFiles.indexOf(migration.file) === -1;
        });
      });
  },

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
  up: function (options) {
    return this._run('up', options, this.pending.bind(this));
  },

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
  down: function (options) {
    var getExecuted = function () {
      return this.executed().bind(this).then(function(migrations) {
        return migrations.reverse();
      });
    }.bind(this);

    if (typeof options === 'undefined' || _.isEqual(options, {})) {
      return getExecuted().bind(this).then(function (migrations) {
        return migrations[0]
          ? this.down(migrations[0].file)
          : Bluebird.resolve([]);
      });
    } else {
      return this._run('down', options, getExecuted.bind(this));
    }
  },

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
  _run: function(method, options, rest) {
    if (typeof options === 'string') {
      return this._run(method, [ options ]);
    } else if (Array.isArray(options)) {
      return Bluebird.resolve(options).bind(this)
        .map(function (migration) {
          return this._findMigration(migration);
        })
        .then(function (migrations) {
          return method === 'up' ?
            this._arePending(migrations) :
            this._wereExecuted(migrations);
        })
        .then(function () {
          return this._run(method, { migrations: options });
        });
    }

    options = _.assign({
      to:         null,
      from:       null,
      migrations: null
    }, options || {});

    if (options.migrations) {
      return this.execute({
        migrations: options.migrations,
        method: method
      });
    } else {
      return rest().bind(this)
        .then(function (migrations) {
          var result = Bluebird.resolve().bind(this);

          if (options.to) {
            result = result
              .then(function () {
                // There must be a migration matching to options.to...
                return this._findMigration(options.to);
              })
              .then(function (migration) {
                // ... and it must be pending/executed.
                return method === 'up' ?
                  this._isPending(migration) :
                  this._wasExecuted(migration);
              });
          }

          return result.then(function () {
            return Bluebird.resolve(migrations)
          });
        })
        .then(function(migrations) {
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
  },

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
  _findMigrationsFromMatch: function (from, method) {
    // We'll fetch all migrations and work our way from start to finish
    return this._findMigrations()
      .bind(this)
      .then(function(migrations) {
        var found = false;
        return migrations.filter(function(migration) {
          if (migration.testFileName(from)) {
            found = true;
            return false;
          }
          return found;
        });
      })
      .filter(function(fromMigration) {
        // now check if they need to be run based on status and method
        return this._wasExecuted(fromMigration)
          .then(function() {
            if (method === 'up') {
              return false;
            } else {
              return true;
            }
          })
          .catch(function() {
            if (method === 'up') {
              return true;
            } else {
              return false;
            }
          });
      });
  },

  /**
   * Pass message to logger if logging is enabled.
   *
   * @param {*} message - Message to be logged.
   */
  log: function(message) {
    if (this.options.logging) {
      this.options.logging(message);
    }
  },

  /**
   * Try to require and initialize storage.
   *
   * @returns {*|SequelizeStorage|JSONStorage|NoneStorage}
   * @private
   */
  _initStorage: function () {
    var Storage;

    try {
      Storage = require(__dirname + '/lib/storages/' + this.options.storage);
    } catch (e) {
      // We have not been able to find the storage locally.
      // Let's try to require a module instead.
    }

    try {
      Storage = Storage || require(this.options.storage);
    } catch (e) {
      throw new Error('Unable to resolve the storage: ' + this.options.storage + ', ' + e);
    }

    return new Storage(this.options);
  },

  /**
   * Loads all migrations in ascending order.
   *
   * @returns {Promise.<Migration[]>}
   * @private
   */
  _findMigrations: function () {
    return Bluebird
      .promisify(fs.readdir)(this.options.migrations.path)
      .bind(this)
      .filter(function (file) {
        return this.options.migrations.pattern.test(file);
      })
      .map(function (file) {
        return path.resolve(this.options.migrations.path, file);
      })
      .map(function (path) {
        return new Migration(path, this.options);
      })
      .then(function (migrations) {
        return migrations.sort(function (a, b) {
          if (a.file > b.file) {
            return 1;
          } else if (a.file < b.file) {
            return -1;
          } else {
            return 0;
          }
        });
      });
  },

  /**
   * Gets a migration with a given name.
   *
   * @param {String} needle - Name of the migration.
   * @returns {Promise.<Migration>}
   * @private
   */
  _findMigration: function (needle) {
    return this
      ._findMigrations()
      .then(function (migrations) {
        return migrations.filter(function (migration) {
          return migration.testFileName(needle);
        })[0];
      })
      .then(function (migration) {
        if (migration) {
          return migration;
        } else {
          return Bluebird.reject(new Error('Unable to find migration: ' + needle));
        }
      });
  },

  /**
   * Checks if migration is executed. It will success if and only if there is
   * an executed migration with a given name.
   *
   * @param {String} _migration - Name of migration to be checked.
   * @returns {Promise}
   * @private
   */
  _wasExecuted: function (_migration) {
    return this.executed().filter(function (migration) {
      return migration.testFileName(_migration.file);
    }).then(function(migrations) {
      if (migrations[0]) {
        return Bluebird.resolve();
      } else {
        return Bluebird.reject(new Error('Migration was not executed: ' + _migration.file));
      }
    });
  },

  /**
   * Checks if a list of migrations are all executed. It will success if and
   * only if there is an executed migration for each given name.
   *
   * @param {String[]} migrationNames - List of migration names to be checked.
   * @returns {Promise}
   * @private
   */
  _wereExecuted: function (migrationNames) {
    return Bluebird
      .resolve(migrationNames)
      .bind(this)
      .map(function (migration) {
        return this._wasExecuted(migration);
      });
  },

  /**
   * Checks if migration is pending. It will success if and only if there is
   * a pending migration with a given name.
   *
   * @param {String} _migration - Name of migration to be checked.
   * @returns {Promise}
   * @private
   */
  _isPending: function (_migration) {
    return this.pending().filter(function (migration) {
      return migration.testFileName(_migration.file);
    }).then(function(migrations) {
      if (migrations[0]) {
        return Bluebird.resolve();
      } else {
        return Bluebird.reject(new Error('Migration is not pending: ' + _migration.file));
      }
    });
  },

  /**
   * Checks if a list of migrations are all pending. It will success if and only
   * if there is a pending migration for each given name.
   *
   * @param {String[]} migrationNames - List of migration names to be checked.
   * @returns {Promise}
   * @private
   */
  _arePending: function (migrationNames) {
    return Bluebird
      .resolve(migrationNames)
      .bind(this)
      .map(function (migration) {
        return this._isPending(migration);
      });
  },

  /**
   * Skip migrations in a given migration list after `to` migration.
   *
   * @param {String} to - The last one migration to be accepted.
   * @param {Migration[]} migrations - Migration list to be filtered.
   * @returns {Promise.<String>} - List of migrations before `to`.
   * @private
   */
  _findMigrationsUntilMatch: function (to, migrations) {
    return Bluebird.resolve(migrations)
      .map(function (migration) { return migration.file })
      .reduce(function (acc, migration) {
        if (acc.add) {
          acc.migrations.push(migration);

          if (to && (migration.indexOf(to) === 0)) {
            // Stop adding the migrations once the final migration
            // has been added.
            acc.add = false;
          }
        }

        return acc;
      }, { migrations: [], add: true })
      .get('migrations');
  }
});
