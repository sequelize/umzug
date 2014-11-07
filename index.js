'use static';

var _         = require('lodash');
var Bluebird  = require('bluebird');
var fs        = require('fs');
var Migration = require('./lib/migration');
var path      = require('path');
var redefine  = require('redefine');

var Migrator = module.exports = redefine.Class({
  constructor: function (options) {
    this.options = _.extend({
      storage:           'json',
      storageOptions:    {},
      upName:            'up',
      downName:          'down',
      migrationsPath:    path.resolve(process.cwd(), 'migrations'),
      migrationsPattern: /^\d+[\s-]+\.js$/
    }, options);

    this.storage = this._initStorage();
  },

  execute: function (options) {
    var self = this;

    options = _.extend({
      migrations: [],
      method:     'up'
    }, options || {});

    return Bluebird
      .map(options.migrations, function (migration) {
        return self._findMigration(migration);
      })
      .then(function (migrations) {
        return _.extend(options, { migrations: migrations });
      })
      .then(function (options) {
        return Bluebird.each(options.migrations, function (migration) {
          return self
            ._wasExecuted(migration)
            .tap(function (executed) {
              if (!executed || (options.method === 'down')) {
                return (migration[options.method] || Bluebird.resolve).call(migration);
              }
            })
            .then(function (executed) {
              if (!executed && (options.method === 'up')) {
                return self.storage.logMigration(migration);
              } else if (options.method === 'down') {
                return self.storage.unlogMigration(migration);
              }
            });
        });
      });
  },

  executed: function () {
    return this.storage.executed();
  },

  pending: function () {
    return this.storage.pending();
  },

  up: function () {
    return this.storage.up();
  },

  down: function () {
    return this.storage.down();
  },

  _initStorage: function () {
    var Storage;

    try {
      Storage = require('./lib/storages/' + this.options.storage);
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

  _findMigration: function (needle) {
    var self = this;

    return Bluebird
      .promisify(fs.readdir)(this.options.migrationsPath)
      .filter(function (file) { return file.indexOf(needle) === 0; })
      .then(function (files) {
        if (files.length > 0) {
          return new Migration(self.options.migrationsPath + files[0]);
        } else {
          return null;
        }
      });
  },

  _wasExecuted: function (_migration) {
    return this.executed().then(function (migrations) {
      return migrations.filter(function (migration) {
        return migration.file === _migration.file;
      })[0];
    });
  }
});
