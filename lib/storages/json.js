'use strict';

var _         = require('lodash');
var Bluebird  = require('bluebird');
var fs        = require('fs');
var Migration = require('../migration');
var path      = require('path');
var redefine  = require('redefine');

module.exports = redefine.Class({
  constructor: function (options) {
    this.options = options;

    this.options.storageOptions = _.extend({
      path: path.resolve(process.cwd(), 'migrations.json'),
    }, this.options.storageOptions)
  },

  pending: function () {
    return new Bluebird(function (resolve, reject) {
      resolve([new Migration, new Migration, new Migration]);
    });
  },

  execute: function (options) {
    var self = this;

    return Bluebird.each(options.migrations, function (migration) {
      return self
        ._wasExecuted(migration, options.method)
        .tap(function (executed) {
          if (!executed || (options.method === 'down')) {
            return (migration[options.method] || Bluebird.resolve).call(migration);
          }
        })
        .then(function (executed) {
          if (!executed && (options.method === 'up')) {
            return self._logMigration(migration);
          } else if (options.method === 'down') {
            return self._unlogMigration(migration);
          }
        });
    });
  },

  _logMigration: function (migration) {
    var filePath  = this.options.storageOptions.path;
    var readfile  = Bluebird.promisify(fs.readFile);
    var writefile = Bluebird.promisify(fs.writeFile);

    return readfile(filePath)
      .catch(function () { return '[]'; })
      .then(function (content) { return JSON.parse(content); })
      .then(function (content) {
        content.push(migration.file);
        return writefile(filePath, JSON.stringify(content, null, "  "));
      });
  },

  _unlogMigration: function (migration) {
    var filePath  = this.options.storageOptions.path;
    var readfile  = Bluebird.promisify(fs.readFile);
    var writefile = Bluebird.promisify(fs.writeFile);

    return readfile(filePath)
      .catch(function () { return '[]'; })
      .then(function (content) { return JSON.parse(content); })
      .then(function (content) {
        content = _.without(content, migration.file);
        return writefile(filePath, JSON.stringify(content, null, "  "));
      });
  },

  _wasExecuted: function (migration) {
    var storage;

    try {
      storage = require(this.options.storageOptions.path);
    } catch (e) {
      storage = [];
    }

    return Bluebird.resolve(storage.indexOf(migration.file) > -1);
  }
});
