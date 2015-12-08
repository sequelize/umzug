'use strict';

var expect    = require('expect.js');
var helper    = require('../helper');
var Umzug     = require('../../index');

describe('Umzug', function () {
  describe('pending', function () {
    beforeEach(function () {
      return helper
        .prepare({
          migrations: { count: 3 },
          squashes:   { count: 3, options: {
            migrations: [
              [ '1-migration.js', '2-migration.js' ],
              [ '2-migration.js', '3-migration.js' ],
              [ '1-migration.js', '2-migration.js', '3-migration.js' ]
            ]
          }}
        })
        .bind(this)
        .spread(function (migrationNames, squashNames) {
          this.migrationNames = migrationNames;
          this.squashNames = squashNames;
          this.umzug          = new Umzug({
            migrations:     { path: __dirname + '/../tmp/' },
            squashes:       { path: __dirname + '/../tmp/squashes/' },
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

      it('returns 3 migrations', function () {
        expect(this.migrations).to.have.length(3);
        expect(this.migrations[0].file).to.equal(this.migrationNames[0] + '.js');
        expect(this.migrations[1].file).to.equal(this.migrationNames[1] + '.js');
        expect(this.migrations[2].file).to.equal(this.migrationNames[2] + '.js');
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

      it('returns only 2 migrations', function () {
        expect(this.migrations).to.have.length(2);
        expect(this.migrations[0].file).to.equal(this.migrationNames[1] + '.js');
        expect(this.migrations[1].file).to.equal(this.migrationNames[2] + '.js');
      });

      it('returns only the migrations that have not been run yet', function () {
        expect(this.migrations[0].file).to.equal(this.migrationNames[1] + '.js');
        expect(this.migrations[1].file).to.equal(this.migrationNames[2] + '.js');
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

      it('returns only 2 migrations', function () {
        expect(this.migrations).to.have.length(2);
        expect(this.migrations[0].file).to.equal(this.migrationNames[1] + '.js');
        expect(this.migrations[1].file).to.equal(this.migrationNames[2] + '.js');
      });

      it('returns only the migrations that have not been run yet', function () {
        expect(this.migrations[0].file).to.equal(this.migrationNames[1] + '.js');
        expect(this.migrations[1].file).to.equal(this.migrationNames[2] + '.js');
      });
    });
  });
});
