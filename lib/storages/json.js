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
      var fun = migration[options.method] || Bluebird.resolve;

      return fun
        .call(migration)
        .then(function () {
          return self._logMigration(migration);
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
        content.push(path.basename(migration.path));
        return writefile(filePath, JSON.stringify(content, null, "  "));
      });
  }
});
