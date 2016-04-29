'use strict';

var _path    = require('path');
var Bluebird = require('bluebird');
var helper   = require('./helper');
var redefine = require('redefine');

/**
 * @class Migration
 */
module.exports = redefine.Class(/** @lends Migration.prototype */{
  /**
   * Wrapper function for migration methods.
   *
   * @callback Migration~wrap
   * @param {function} - Migration method to be wrapped.
   * @return {*|Promise}
   */

  /**
   * Constructs Migration.
   *
   * @param {String} path - Path of the migration file.
   * @param {Object} options
   * @param {String} options.upName - Name of the method `up` in migration
   * module.
   * @param {String} options.downName - Name of the method `down` in migration
   * module.
   * @param {Object} options.migrations
   * @param {Migration~wrap} options.migrations.wrap - Wrapper function for
   * migration methods.
   * @constructs Migration
   */
  constructor: function(path, options) {
    this.path    = _path.resolve(path);
    this.file    = _path.basename(this.path);
    this.options = options;
  },

  /**
   * Tries to require migration module. CoffeeScript support requires
   * 'coffee-script' to be installed.
   *
   * @returns {Object} Required migration module
   */
  migration: function () {
    if (this.path.match(/\.coffee$/)) {
      // 1.7.x compiler registration
      helper.resolve('coffee-script/register') ||

      // Prior to 1.7.x compiler registration
      helper.resolve('coffee-script') ||
      /* jshint expr: true */
      (function () {
        console.error('You have to add "coffee-script" to your package.json.');
        process.exit(1);
      })();
    }

    return require(this.path);
  },

  /**
   * Executes method `up` of migration.
   *
   * @returns {*|Promise}
   */
  up: function () {
    return this._exec(this.options.upName, [].slice.apply(arguments));
  },

  /**
   * Executes method `down` of migration.
   *
   * @returns {*|Promise}
   */
  down: function () {
    return this._exec(this.options.downName, [].slice.apply(arguments));
  },

  /**
   * Check if migration file name is starting with needle.
   * @param {String} needle - The beginning of the file name.
   * @returns {boolean}
   */
  testFileName: function (needle) {
    return this.file.indexOf(needle) === 0;
  },

  /**
   * Executes a given method of migration with given arguments.
   *
   * @param {String} method - Name of the method to be called.
   * @param {*} args - Arguments to be used when called the method.
   * @returns {*|Promise}
   * @private
   */
  _exec: function (method, args) {
    var migration  = this.migration();
    var fun        = migration[method] || Bluebird.resolve;
    var wrappedFun = this.options.migrations.wrap(fun);

    return wrappedFun.apply(migration, args);
  }
});
