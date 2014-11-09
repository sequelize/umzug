'use strict';

var _         = require('lodash');
var Bluebird  = require('bluebird');
var expect    = require('expect.js');
var helper    = require('./helper');
var Migration = require('../lib/migration');
var Migrator  = require('../index');
var sinon     = require('sinon');

describe('Migrator', function () {
  describe('constructor', function () {
    it('exposes some methods', function () {
      var migrator = new Migrator();

      expect(migrator).to.have.property('execute');
      expect(migrator).to.have.property('pending');
      expect(migrator).to.have.property('up');
      expect(migrator).to.have.property('down');
    });

    it('instantiates the default storage', function () {
      var migrator = new Migrator();
      expect(migrator).to.have.property('storage');
    });

    it('loads the specified storage module', function () {
      var migrator = new Migrator({ storage: 'moment' });
      expect(migrator).to.have.property('storage');
    });

    it('throws an error if the specified storage is neither a package nor a file', function () {
      expect(function () {
        new Migrator({ storage: 'nomnom' });
      }).to.throwError(
        Error, /Unable to resolve the storage: omnom/
      )
    });
  });
});
