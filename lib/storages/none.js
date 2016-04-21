'use strict';

var Bluebird  = require('bluebird');
var redefine  = require('redefine');

/**
 * @class NoneStorage
 */
module.exports = redefine.Class(/** @lends NoneStorage.prototype */ {
  /**
   * Constructs none storage.
   *
   * @param {Object} [options]
   * @constructs NoneStorage
   */
  constructor: function (options) {},

  /**
   * Does nothing.
   *
   * @param {String} migrationName - Name of migration to be logged.
   * @returns {Promise}
   */
  logMigration: function (migrationName) {
    return Bluebird.resolve();
  },

  /**
   * Does nothing.
   *
   * @param {String} migrationName - Name of migration to unlog.
   * @returns {Promise}
   */
  unlogMigration: function (migrationName) {
    return Bluebird.resolve();
  },

  /**
   * Does nothing.
   *
   * @returns {Promise.<String[]>}
   */
  executed: function () {
    return Bluebird.resolve([]);
  }
});
