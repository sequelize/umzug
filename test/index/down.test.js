'use strict';

var _         = require('lodash');
var Bluebird  = require('bluebird');
var expect    = require('expect.js');
var helper    = require('../helper');
var Migration = require('../../lib/migration');
var Migrator  = require('../../index');
var sinon     = require('sinon');

describe('Migrator', function () {
  describe('down', function () {
    beforeEach(function () {
      return helper
        .prepareMigrations(3)
        .bind(this)
        .then(function (migrationNames) {
          this.migrationNames = migrationNames;
          this.migrator       = new Migrator({
            migrationsPath: __dirname + '/../tmp/',
            storageOptions: {
              path: __dirname + '/../tmp/migrations.json'
            }
          });
        });
    });

    describe('when no migrations has been executed yet', function () {
      beforeEach(function () {
        return this.migrator.down().bind(this).then(function (migrations) {
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

    describe('when a migration has been executed already', function () {
      beforeEach(function () {
        return this.migrator.execute({
          migrations: [ this.migrationNames[0] ],
          method:     'up'
        }).bind(this).then(function () {
          return this.migrator.executed();
        }).then(function (migrations) {
          expect(migrations).to.have.length(1);
        }).then(function () {
          return this.migrator.down();
        }).then(function (migrations) {
          this.migrations = migrations;
        });
      });

      it('returns 1 item', function () {
        expect(this.migrations).to.have.length(1);
        expect(this.migrations[0].file).to.equal(this.migrationNames[0] + '.js');
      });

      it('removes the reverted migrations from the storage', function () {
        return this.migrator.executed().then(function (migrations) {
          expect(migrations).to.have.length(0);
        });
      });
    });

    describe('when all migrations have been executed already', function () {
      beforeEach(function () {
        return this.migrator.execute({
          migrations: this.migrationNames,
          method:     'up'
        }).bind(this).then(function () {
          return this.migrator.executed();
        }).then(function (migrations) {
          expect(migrations).to.have.length(3);
        });
      });

      describe('when no option is specified', function () {
        beforeEach(function () {
          return this.migrator.down().bind(this).then(function (migrations) {
            this.migrations = migrations;
          });
        });

        it('returns 1 item', function () {
          expect(this.migrations).to.have.length(1);
          expect(this.migrations[0].file).to.equal(this.migrationNames[2] + '.js');
        });

        it('removes the reverted migrations from the storage', function () {
          return this.migrator.executed().bind(this).then(function (migrations) {
            expect(migrations).to.have.length(2);
            expect(migrations[0].file).to.equal(this.migrationNames[0] + '.js');
            expect(migrations[1].file).to.equal(this.migrationNames[1] + '.js');
          });
        });
      });

      describe('when `to` option is passed', function () {
        beforeEach(function () {
          return this.migrator.down({
            to: this.migrationNames[1]
          }).bind(this).then(function (migrations) {
            this.migrations = migrations;
          });
        });

        it('returns 2 item', function () {
          expect(this.migrations).to.have.length(2);
          expect(this.migrations[0].file).to.equal(this.migrationNames[2] + '.js');
          expect(this.migrations[1].file).to.equal(this.migrationNames[1] + '.js');
        });

        it('removes the reverted migrations from the storage', function () {
          return this.migrator.executed().bind(this).then(function (migrations) {
            expect(migrations).to.have.length(1);
            expect(migrations[0].file).to.equal(this.migrationNames[0] + '.js');
          });
        });
      });
    });
  });
});
