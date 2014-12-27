'use strict';

var _path    = require('path');
var Bluebird = require('bluebird');
var helper   = require('./helper');
var redefine = require('redefine');

module.exports = redefine.Class({
  constructor: function(path, options) {
    this.path    = _path.resolve(path);
    this.file    = _path.basename(this.path);
    this.options = options;
   },

  migration: function () {
    if (this.path.match(/\.coffee$/)) {
      // 1.7.x compiler registration
      helper.resolve('coffee-script/register') ||

      // Prior to 1.7.x compiler registration
      helper.resolve('coffee-script') ||

      (function () {
        console.error('You have to add \"coffee-script\" to your package.json.');
        process.exit(1);
      })();
    }

    return require(this.path);
  },

  up: function () {
    return this._exec('up', [].slice.apply(arguments));
  },

  down: function () {
    return this._exec('down', [].slice.apply(arguments));
  },

  testFileName: function (needle) {
    return this.file.indexOf(needle) === 0;
  },

  _exec: function (method, args) {
    var migration  = this.migration();
    var fun        = migration[method] || Bluebird.resolve;
    var wrappedFun = this.options.migrations.wrap(fun);

    return wrappedFun.apply(migration, args);
  }
});
