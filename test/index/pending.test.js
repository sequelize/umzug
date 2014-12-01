'use strict';

var _         = require('lodash');
var Bluebird  = require('bluebird');
var expect    = require('expect.js');
var helper    = require('../helper');
var Migration = require('../../lib/migration');
var Migrator  = require('../../index');
var sinon     = require('sinon');

describe('Migrator', function () {
  describe('pending', function () {
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
        return this.migrator.pending().bind(this).then(function (migrations) {
          this.migrations = migrations;
        });
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

    describe('when a migration has been executed already', function () {
      beforeEach(function () {
        return this.migrator.execute({
          migrations: [ this.migrationNames[0] ],
          method:     'up'
        }).bind(this).then(function () {
          return this.migrator.pending();
        }).then(function (migrations) {
          this.migrations = migrations;
        });
      });

      it('returns only 2 items', function () {
        expect(this.migrations).to.have.length(2);
      });

      it('returns only the migrations that have not been run yet', function () {
        var self = this;

        this.migrationNames.slice(1).forEach(function (migrationName, i) {
          expect(self.migrations[i].file).to.equal(migrationName + '.js');
        });
      });
    });

    describe('when storage returns a thenable', function () {
      beforeEach(function () {

        //a migration has been executed already
        return this.migrator.execute({
          migrations: [ this.migrationNames[0] ],
          method:     'up'
        }).bind(this).then(function () {

          //storage returns a thenable
          this.migrator.storage = helper.wrapStorageAsCustomThenable(this.migrator.storage);
          
          return this.migrator.pending();
        }).then(function (migrations) {
          this.migrations = migrations;
        });
      });

      it('returns only 2 items', function () {
        expect(this.migrations).to.have.length(2);
      });

      it('returns only the migrations that have not been run yet', function () {
        var self = this;

        this.migrationNames.slice(1).forEach(function (migrationName, i) {
          expect(self.migrations[i].file).to.equal(migrationName + '.js');
        });
      });
    });
  });
});
