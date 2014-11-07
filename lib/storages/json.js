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

  logMigration: function (migration) {
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

  unlogMigration: function (migration) {
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

  executed: function () {
    var storage;

    try {
      storage = require(this.options.storageOptions.path);
    } catch (e) {
      storage = [];
    }

    return Bluebird.resolve(storage.map(function (file) {
      return new Migration(file);
    }));
  }
});
