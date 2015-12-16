'use strict';

var Bluebird  = require('bluebird');
var redefine  = require('redefine');

module.exports = redefine.Class({
  constructor: function (options) {},

  logMigration: function (migrationName) {
    return Bluebird.resolve();
  },

  unlogMigration: function (migrationName) {
    return Bluebird.resolve();
  },

  executed: function () {
    return Bluebird.resolve([]);
  }
});
