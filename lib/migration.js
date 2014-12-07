'use strict';

var Bluebird = require('bluebird');
var _path    = require('path');
var redefine = require('redefine');

module.exports = redefine.Class({
  constructor: function(path, options) {
    this.path    = _path.resolve(path);
    this.file    = _path.basename(this.path);
    this.options = options;
   },

  migration: function () {
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
    var migration = this.migration();
    return (migration[method] || Bluebird.resolve).apply(migration, args);
  }
});
