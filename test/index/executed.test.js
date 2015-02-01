'use strict';

var Bluebird  = require('bluebird');
var expect    = require('expect.js');
var helper    = require('../helper');
var Migration = require('../../lib/migration');
var Umzug     = require('../../index');
var sinon     = require('sinon');

describe('Umzug', function () {
  describe('executed', function () {
    beforeEach(function () {
      return helper
        .prepareMigrations(3)
        .bind(this)
        .then(function (migrationNames) {
          this.migrationNames = migrationNames;
          this.umzug          = new Umzug({
            migrations:     { path: __dirname + '/../tmp/' },
            storageOptions: { path: __dirname + '/../tmp/umzug.json' }
          });
        });
    });

    describe('when no migrations has been executed yet', function () {
      beforeEach(function () {
        return this.umzug.executed()
          .bind(this).then(function (migrations) {
            this.migrations = migrations;
          });
      });

      it('returns an array', function () {
        expect(this.migrations).to.be.an(Array);
      });

      it('returns 0 items', function () {
        expect(this.migrations).to.have.length(0);
      });
    });

    describe('when one migration has been executed yet', function () {
      beforeEach(function () {
        return this.umzug.execute({
          migrations: [ this.migrationNames[0] ],
          method:     'up'
        }).bind(this).then(function () {
          return this.umzug.executed()
        }).then(function (migrations) {
          this.migrations = migrations;
        });
      });

      it('returns an array', function () {
        expect(this.migrations).to.be.an(Array);
      });

      it('returns 1 items', function () {
        expect(this.migrations).to.have.length(1);
        expect(this.migrations[0].file).to.equal(this.migrationNames[0] + '.js');
      });
    });

    describe('when all migration has been executed yet', function () {
      beforeEach(function () {
        return this.umzug.execute({
          migrations: this.migrationNames,
          method:     'up'
        }).bind(this).then(function () {
          return this.umzug.executed()
        }).then(function (migrations) {
          this.migrations = migrations;
        });
      });

      it('returns an array', function () {
        expect(this.migrations).to.be.an(Array);
      });

      it('returns 3 items', function () {
        expect(this.migrations).to.have.length(3);
        expect(this.migrations[0].file).to.equal(this.migrationNames[0] + '.js');
        expect(this.migrations[1].file).to.equal(this.migrationNames[1] + '.js');
        expect(this.migrations[2].file).to.equal(this.migrationNames[2] + '.js');
      });
    });

    describe('when storage returns a thenable', function() {
      beforeEach(function() {
        // migration has been executed already
        return this.umzug.execute({
          migrations: [ this.migrationNames[0] ],
          method:     'up'
        }).bind(this).then(function () {
          this.umzug.storage = helper.wrapStorageAsCustomThenable(this.umzug.storage);
          return this.umzug.executed();
        }).then(function (migrations) {
          this.migrations = migrations;
        });
      });

      it('returns an array', function () {
        expect(this.migrations).to.be.an(Array);
      });

      it('returns 1 items', function () {
        expect(this.migrations).to.have.length(1);
        expect(this.migrations[0].file).to.equal(this.migrationNames[0] + '.js');
      });
    });

  });
});
