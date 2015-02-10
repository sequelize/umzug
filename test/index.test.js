'use strict';

var Bluebird  = require('bluebird');
var expect    = require('expect.js');
var helper    = require('./helper');
var Migration = require('../lib/migration');
var Umzug     = require('../index');
var sinon     = require('sinon');

describe('Umzug', function () {
  describe('constructor', function () {
    it('exposes some methods', function () {
      var umzug = new Umzug();

      expect(umzug).to.have.property('execute');
      expect(umzug).to.have.property('pending');
      expect(umzug).to.have.property('up');
      expect(umzug).to.have.property('down');
      expect(umzug).to.have.property('log');
    });

    it('instantiates the default storage', function () {
      var umzug = new Umzug();
      expect(umzug).to.have.property('storage');
    });

    it('loads the specified storage module', function () {
      var umzug = new Umzug({ storage: 'moment' });
      expect(umzug).to.have.property('storage');
    });

    it('throws an error if the specified storage is neither a package nor a file', function () {
      expect(function () {
        new Umzug({ storage: 'nomnom' });
      }).to.throwError(
        Error, /Unable to resolve the storage: omnom/
      )
    });

    it('accepts a logging function', function () {
      var spy = sinon.spy();
      var umzug = new Umzug({ logging: spy });
      umzug.log();
      expect(spy.called).to.be(true);
    });
  });
});
