'use strict';

var _         = require('lodash');
var Bluebird  = require('bluebird');
var fs        = require('fs');
var path      = require('path');
var redefine  = require('redefine');

/**
 * @class JSONStorage
 */
module.exports = redefine.Class(/** @lends JSONStorage.prototype */ {
  /**
   * Constructs JSON file storage.
   *
   * @param {Object} [options]
   * @param {Object} [options.storageOptions]
   * @param {String} [options.storageOptions.path='./umzug.json'] - Path to JSON
   * file where the log is stored. Defaults './umzug.json' relative to process'
   * cwd.
   * @constructs JSONStorage
   */
  constructor: function (options) {
    this.options = options || {};

    this.options.storageOptions = _.assign({
      path: path.resolve(process.cwd(), 'umzug.json')
    }, this.options.storageOptions || {});
  },

  /**
   * Logs migration to be considered as executed.
   *
   * @param {String} migrationName - Name of the migration to be logged.
   * @returns {Promise}
   */
  logMigration: function (migrationName) {
    var filePath  = this.options.storageOptions.path;
    var readfile  = Bluebird.promisify(fs.readFile);
    var writefile = Bluebird.promisify(fs.writeFile);

    return readfile(filePath)
      .catch(function () { return '[]'; })
      .then(function (content) { return JSON.parse(content); })
      .then(function (content) {
        content.push(migrationName);
        return writefile(filePath, JSON.stringify(content, null, '  '));
      });
  },

  /**
   * Unlogs migration to be considered as pending.
   *
   * @param {String} migrationName - Name of the migration to be unlogged.
   * @returns {Promise}
   */
  unlogMigration: function (migrationName) {
    var filePath  = this.options.storageOptions.path;
    var readfile  = Bluebird.promisify(fs.readFile);
    var writefile = Bluebird.promisify(fs.writeFile);

    return readfile(filePath)
      .catch(function () { return '[]'; })
      .then(function (content) { return JSON.parse(content); })
      .then(function (content) {
        content = _.without(content, migrationName);
        return writefile(filePath, JSON.stringify(content, null, '  '));
      });
  },

  /**
   * Gets list of executed migrations.
   *
   * @returns {Promise.<String[]>}
   */
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
