'use strict';

var _         = require('lodash');
var expect    = require('expect.js');
var helper    = require('./helper');
var Migration = require('../lib/migration');
var Migrator  = require('../index');

describe('Migrator', function () {
  describe('constructor', function () {
    it('exposes some methods', function () {
      var migrator = new Migrator();

      expect(migrator).to.have.property('execute');
      expect(migrator).to.have.property('pending');
      expect(migrator).to.have.property('up');
      expect(migrator).to.have.property('down');
    });
  });

  describe('pending', function () {
    before(function (done) {
      helper.clearMigrations();
      _.times(3, helper.generateDummyMigration);

      var migrator = new Migrator({
        migrationsPath: __dirname + '/tmp/'
      });

      migrator
        .pending()
        .bind(this)
        .then(function (migrations) { this.migrations = migrations })
        .then(done);
    });

    it('returns an array', function () {
      expect(this.migrations).to.be.an(Array);
    });

    it('returns 3 items', function () {
      expect(this.migrations).to.have.length(3);
    });

    it('returns migration instances', function () {
      this.migrations.forEach(function (migration) {
        expect(migration).to.be.a(Migration);
      });
    });
  });
});
