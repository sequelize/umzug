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

  describe('pending', function () {
    before(function (done) {
      helper
        .prepareMigrations(3)
        .bind(this)
        .then(function () {
          var migrator = new Migrator({
            migrationsPath: __dirname + '/tmp/'
          });

          return migrator.pending()
        })
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

  describe('execute', function () {
    before(function (done) {
      helper
        .prepareMigrations(1, { names: ['123-migration'] })
        .bind(this)
        .then(function () {
          this.migrator = new Migrator({
            migrationsPath: __dirname + '/tmp/',
            storageOptions: {
              path: __dirname + '/tmp/migrations.json'
            }
          });
        })
        .then(done);
    });

    it('runs the up method of the migration', function (done) {
      var migration = require('./tmp/123-migration.js');
      var upStub    = sinon.stub(migration, 'up', Bluebird.resolve);
      var downStub  = sinon.stub(migration, 'down', Bluebird.resolve);

      this
        .migrator
        .execute({ migrations: ['123-migration'], method: 'up' })
        .then(function () {
          expect(upStub.callCount).to.equal(1);
          expect(downStub.callCount).to.equal(0);
        })
        .finally(function () {
          upStub.restore();
          downStub.restore();
          done();
        });
    });

    it('runs the down method of the migration', function (done) {
      var migration = require('./tmp/123-migration.js');
      var upStub    = sinon.stub(migration, 'up', Bluebird.resolve);
      var downStub  = sinon.stub(migration, 'down', Bluebird.resolve);

      this
        .migrator
        .execute({ migrations: ['123-migration'], method: 'down' })
        .then(function () {
          expect(upStub.callCount).to.equal(0);
          expect(downStub.callCount).to.equal(1);
        })
        .finally(function () {
          upStub.restore();
          downStub.restore();
          done();
        });
    });
  });
});
