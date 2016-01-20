'use strict';

var _        = require('lodash');
var _path    = require('path');
var Bluebird = require('bluebird');
var helper   = require('./helper');
var redefine = require('redefine');

module.exports = redefine.Class({
  constructor: function(path, options) {
    this.path    = _path.resolve(path);
    this.file    = _path.basename(this.path);
    this.name    = _path.basename(this.file, _path.extname(this.file));
    this.options = options;
   },

  migration: function () {
    if (this.path.match(/\.coffee$/)) {
      // 1.7.x compiler registration
      helper.resolve('coffee-script/register') ||

      // Prior to 1.7.x compiler registration
      helper.resolve('coffee-script') ||
      /* jshint expr: true */
      (function () {
        console.error('You have to add \"coffee-script\" to your package.json.');
        process.exit(1);
      })();
    }

    return require(this.path);
  },

  migrations: function () {
    var migration  = this.migration();
    var migrations = migration.migrations;

    if (typeof migrations === 'function') {
      migrations = migrations();
    }

    if (typeof migrations === 'string') {
      migrations = [ migrations ];
    }

    if (Array.isArray(migrations)) {
      return migrations;
    } else {
      return [ this.file ];
    }
  },

  up: function () {
    return this._exec('up', [].slice.apply(arguments));
  },

  down: function () {
    return this._exec('down', [].slice.apply(arguments));
  },

  testFileName: function (needle) {
    if (!Array.isArray(needle)) {
      return this.testFileName([ needle ]);
    }

    return _.any(needle, function (fileName) {
      return this.file.indexOf(fileName) === 0;
    }, this);
  },

  _exec: function (method, args) {
    var migration  = this.migration();
    var fun        = migration[method] || Bluebird.resolve;
    var wrappedFun = this.options.migrations.wrap(fun);

    return wrappedFun.apply(migration, args);
  }
});
