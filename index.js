'use strict';

var _         = require('lodash');
var Bluebird  = require('bluebird');
var fs        = require('fs');
var Migration = require('./lib/migration');
var path      = require('path');
var redefine  = require('redefine');

var Umzug = module.exports = redefine.Class({
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

    this.options.squashes = _.assign({
      params:  [],
      path:    path.resolve(process.cwd(), 'migrations/squashes'),
      pattern: /^[\w-]+\.js$/,
      wrap:    function (fun) { return fun; }
    }, this.options.squashes);

    this.storage = this._initStorage();
  },

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
        return self._applySquashes(migrations);
      })
      .then(function (migrations) {
        return _.assign(options, { migrations: migrations });
      })
      .then(function (options) {
        return Bluebird.each(options.migrations, function (migration) {
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
                  self.log("== " + migration.name + ": migrating =======");
                } else {
                  self.log("== " + migration.name + ": reverting =======");
                }

                startTime = new Date();

                return fun.apply(migration, params);
              }
            })
            .then(function (executed) {
                return Bluebird
                  .resolve(migration.migrations())
                  .bind(this)
                  .mapSeries(function (migrationName) {
                    if (!executed && (options.method === 'up')) {
                      return Bluebird.resolve(self.storage.logMigration(migrationName));
                    } else if (options.method === 'down') {
                      return Bluebird.resolve(self.storage.unlogMigration(migrationName));
                    }
                  });
            })
            .tap(function () {
              var duration = ((new Date() - startTime) / 1000).toFixed(3);
              if (options.method === 'up') {
                self.log("== " + migration.name + ": migrated (" + duration +  "s)\n");
              } else {
                self.log("== " + migration.name + ": reverted (" + duration +  "s)\n");
              }
            });
        });
      });
  },

  executed: function () {
    return Bluebird.resolve(this.storage.executed()).bind(this).map(function (file) {
      return new Migration(file);
    });
  },

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
        }).sort(function (a, b) {
          if (a.file > b.file) {
            return 1;
          } else  if (a.file < b.file) {
            return -1;
          } else {
            return 0;
          }
        });
      });
  },

  up: function (options) {
    if (typeof options === 'string') {
      return this.up([ options ]);
    } else if (Array.isArray(options)) {
      return Bluebird.resolve(options).bind(this)
        .map(function (migration) {
          return this._findMigration(migration)
        })
        .then(function (migrations) {
          return this._arePending(migrations);
        })
        .then(function () {
          return this.up({ migrations: options });
        });
    }

    options = _.assign({
      to:         null,
      migrations: null
    }, options || {});

    if (options.migrations) {
      return this.execute({ migrations: options.migrations, method: 'up' });
    } else {
      return this.pending().bind(this)
        .then(function (migrations) {
          var result = Bluebird.resolve().bind(this);

          if (options.to) {
            result = result
              .then(function () {
                // There must be a migration matching to options.to...
                return this._findMigration(options.to);
              })
              .then(function (migration) {
                // ... and it must be pending.
                return this._isPending(migration);
              });
          }

          return result.then(function () {
            return Bluebird.resolve(migrations)
          });
        })
        .then(function (migrations) {
          return this._findMigrationsUntilMatch(options.to, migrations);
        })
        .then(function (migrationFiles) {
          return this.up({ migrations: migrationFiles });
        });
    }
  },

  down: function (options) {
    var getExecuted = function () {
      return this.executed().bind(this).then(function(migrations) {
        return migrations.reverse();
      });
    }.bind(this);

    if (typeof options === 'undefined') {
      return getExecuted().bind(this).then(function (migrations) {
        return migrations[0] ? this.down(migrations[0].file) : Bluebird.resolve([]);
      });
    } else if (typeof options === 'string') {
      return this.down([ options ]);
    } else if (Array.isArray(options)) {
      return Bluebird.resolve(options).bind(this)
        .map(function (migration) {
          return this._findMigration(migration)
        })
        .then(function (migrations) {
          return this._wereExecuted(migrations);
        })
        .then(function () {
          return this.down({ migrations: options });
        });
    }

    options = _.assign({
      to:         null,
      migrations: null
    }, options || {});

    if (options.migrations) {
      return this.execute({ migrations: options.migrations, method: 'down' });
    } else {
      return getExecuted().bind(this)
        .then(function (migrations) {
          var result = Bluebird.resolve().bind(this);

          if (options.to) {
            result = result
              .then(function () {
                // There must be a migration matching to options.to...
                return this._findMigration(options.to);
              })
              .then(function (migration) {
                // ... and it must be executed.
                return this._wasExecuted(migration);
              });
          }

          return result.then(function () {
            return Bluebird.resolve(migrations)
          });
        })
        .then(function (migrations) {
          return this._findMigrationsUntilMatch(options.to, migrations);
        })
        .then(function (migrationFiles) {
          return this.down({ migrations: migrationFiles });
        });
    }
  },

  log: function(message) {
    if (this.options.logging) {
      this.options.logging(message);
    }
  },

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
      throw new Error('Unable to resolve the storage: ' + this.options.storage);
    }

    return new Storage(this.options);
  },

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
      });
  },

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

  _wasExecuted: function (migration) {
    var migrationNames = migration.migrations();

    return this.executed().filter(function (_migration) {
      return _migration.testFileName(migrationNames);
    }).then(function(migrations) {
      if (migrations[0]) {
        return Bluebird.resolve();
      } else {
        var error = migrationNames.length > 1 ?
          new Error('Squashed migration was not executed: ' + migration.file) :
          new Error('Migration was not executed: ' + migration.file);

        return Bluebird.reject(error);
      }
    });
  },

  _wereExecuted: function (migrationNames) {
    return Bluebird
      .resolve(migrationNames)
      .bind(this)
      .map(function (migration) {
        return this._wasExecuted(migration);
      });
  },

  _isPending: function (migration) {
    var migrationNames = migration.migrations();

    return this.pending().filter(function (_migration) {
      return _migration.testFileName(migrationNames);
    }).then(function(migrations) {
      if (migrations[0]) {
        return Bluebird.resolve();
      } else {
        var error = migrationNames.length > 1 ?
          new Error('Squashed migration is not pending: ' + migration.file) :
          new Error('Migration is not pending: ' + migration.file);

        return Bluebird.reject(error);
      }
    });
  },

  _arePending: function (migrationNames) {
    return Bluebird
      .resolve(migrationNames)
      .bind(this)
      .map(function (migration) {
        return this._isPending(migration);
      });
  },

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
  },

  /**
   * Try to apply all squashes and reduce length of migrations list.
   *
   * This function is using First Fit Decreasing algorithm. It is not perfect
   * nor fast.
   *
   * TODO: Please improve this with a better algorithm.
   *
   * @param {Migration[]} migrations
   * @returns {Promise.<Migration[]>}
   * @private
   */
  _applySquashes: function (migrations) {
    return this._loadSquashes()
      .then(function (squashes) {
        return _.sortBy(squashes, function (squash) {
          return -squash.migrations().length;
        });
      })
      .reduce(function (acc, squash) {
        return this._applySquash(acc, squash);
      }, migrations);
  },

  /**
   * Squash can be applied if and only if all the squashed migrations are in
   * migrations as a continuous queue. Internal order of squashed migrations
   * does not matter. Thus, there are three groups in migrations: 1 migrations
   * before the squash, 2 squashed migrations in any order, and 3 migrations
   * after the squash. The aim is to find group 2 and replace it by the squash.
   * Thus, the result is migrations before the squash, the squash, and
   * migrations after the squash.
   *
   * If the squash cannot be applied, the result is migrations without any
   * changes.
   *
   * @param {Migration[]} migrations
   * @param {Migration} squash
   * @returns {Promise.<Migration[]>}
   * @private
   */
  _applySquash: function (migrations, squash) {
    var originalSquashed = squash.migrations();

    return Bluebird.resolve(migrations).bind(this)
      .reduce(function (acc, migration) {
        var isSquash = migration.migrations().length > 1;

        if (acc.alreadyApplied) {
          // Squash is already applied. This migration belongs to group 3
          // migrations after the squash.
          acc.afterSquash.push(migration);
        } else if (isSquash || !migration.testFileName(acc.squashed)) {
          // This migration is an another squash or it is not in the list of
          // squashed migrations we are looking for. In both cases, all the
          // previous migrations (including current one) belongs to the group 1
          // migrations before the squash.
          acc.squashed = originalSquashed;
          acc.beforeSquash = acc.beforeSquash.concat(acc.withinSquash);
          acc.beforeSquash.push(migration);
          acc.withinSquash = [];
        } else {
          // This migration is one of the squashed migrations. It belongs to
          // group 2 squashed migrations if and only if all rest of the squashed
          // migrations are right after the current migration.
          acc.withinSquash.push(migration);
          acc.squashed = _.filter(acc.squashed, function (name) {
            return !migration.testFileName(name);
          });

          if (acc.squashed.length === 0) {
            // All squashed migrations are found. Replace them with the squash.
            acc.withinSquash = [ squash ];
            acc.alreadyApplied = true;
          }
        }

        return acc;
      }, {
        squashed: originalSquashed,
        beforeSquash: [],
        withinSquash: [],
        afterSquash: [],
        alreadyApplied: false
      })
      .then(function (acc) {
        // Join all the three groups.
        return Bluebird.resolve(
          _.flatten([acc.beforeSquash, acc.withinSquash, acc.afterSquash])
        );
      });
  },

  /**
   * Load squashes and return them.
   *
   * @returns {Promise.<Migration[]>}
   * @private
   */
  _loadSquashes: function () {
    return Bluebird
      .promisify(fs.readdir)(this.options.squashes.path)
      .bind(this)
      .catch(function () {
        return [];
      })
      .filter(function (file) {
        return this.options.squashes.pattern.test(file);
      })
      .map(function (file) {
        return path.resolve(this.options.squashes.path, file);
      })
      .map(function (path) {
        return new Migration(path, this.options);
      });
  }
});
