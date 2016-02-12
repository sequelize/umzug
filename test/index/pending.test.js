'use strict';

var expect    = require('expect.js');
var helper    = require('../helper');
var Migration = require('../../lib/migration');
var Umzug     = require('../../index');

describe('pending', function () {
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
      return this.umzug.pending().bind(this).then(function (migrations) {
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
      return this.umzug.execute({
        migrations: [ this.migrationNames[0] ],
        method:     'up'
      }).bind(this).then(function () {
        return this.umzug.pending();
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
      return this.umzug.execute({
        migrations: [ this.migrationNames[0] ],
        method:     'up'
      }).bind(this).then(function () {

        //storage returns a thenable
        this.umzug.storage = helper.wrapStorageAsCustomThenable(this.umzug.storage);

        return this.umzug.pending();
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
