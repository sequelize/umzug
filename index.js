'use static';

var _         = require('lodash');
var Bluebird  = require('bluebird');
var Migration = require('./lib/migration');
var path      = require('path');
var redefine  = require('redefine');

var Migrator = module.exports = redefine.Class({
  constructor: function (options) {
    this.options = _.extend({
      stprage:           'json',
      storageOptions:    {},
      upName:            'up',
      downName:          'down',
      migrationsPath:    path.resolve(process.cwd(), 'migrations'),
      migrationsPattern: /^\d+[\s-]+\.js$/
    }, options);
  },

  execute: function () {},
  pending: function () {
    return new Bluebird(function (resolve, reject) {
      resolve([new Migration, new Migration, new Migration]);
    });
  },
  up:      function () {},
  down:    function () {}
});
