'use strict';

var Bluebird = require('bluebird');
var _path    = require('path');
var redefine = require('redefine');

module.exports = redefine.Class({
  constructor: function(path) {
    this.file = _path.basename(path);
    this.path = path;
  },

  migration: function () {
    return require(this.path);
  },

  up: function () {
    return (this.migration().up || Bluebird.resolve)();
  },

  down: function () {
    return (this.migration().down || Bluebird.resolve)();
  }
});
