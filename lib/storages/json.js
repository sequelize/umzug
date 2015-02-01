'use strict';

var _         = require('lodash');
var Bluebird  = require('bluebird');
var fs        = require('fs');
var path      = require('path');
var redefine  = require('redefine');

module.exports = redefine.Class({
  constructor: function (options) {
    this.options = options || {};

    this.options.storageOptions = _.assign({
      path: path.resolve(process.cwd(), 'umzug.json'),
    }, this.options.storageOptions || {})
  },

  logMigration: function (migrationName) {
    var filePath  = this.options.storageOptions.path;
    var readfile  = Bluebird.promisify(fs.readFile);
    var writefile = Bluebird.promisify(fs.writeFile);

    return readfile(filePath)
      .catch(function () { return '[]'; })
      .then(function (content) { return JSON.parse(content); })
      .then(function (content) {
        content.push(migrationName);
        return writefile(filePath, JSON.stringify(content, null, "  "));
      });
  },

  unlogMigration: function (migrationName) {
    var filePath  = this.options.storageOptions.path;
    var readfile  = Bluebird.promisify(fs.readFile);
    var writefile = Bluebird.promisify(fs.writeFile);

    return readfile(filePath)
      .catch(function () { return '[]'; })
      .then(function (content) { return JSON.parse(content); })
      .then(function (content) {
        content = _.without(content, migrationName);
        return writefile(filePath, JSON.stringify(content, null, "  "));
      });
  },

  executed: function () {
    var filePath = this.options.storageOptions.path;
    var readfile = Bluebird.promisify(fs.readFile);

    return readfile(filePath)
      .catch(function () { return '[]'; })
      .then(function (content) {
        return JSON.parse(content);
      });
  }
});
