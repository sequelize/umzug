'use static';

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
        return _.assign(options, { migrations: migrations });
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
                } else {
                  self.log("== " + name + ": reverting =======");
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
              } else {
                self.log("== " + name + ": reverted (" + duration +  "s)\n");
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

  _wereExecuted: function (migrationNames) {
    return Bluebird
      .resolve(migrationNames)
      .bind(this)
      .map(function (migration) {
        return this._wasExecuted(migration);
      });
  },

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
  }
});
