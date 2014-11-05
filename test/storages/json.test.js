'use strict';

var _         = require('lodash');
var Bluebird  = require('bluebird');
var expect    = require('expect.js');
var helper    = require('../helper');
var Migration = require('../../lib/migration');
var Migrator  = require('../../index');
var sinon     = require('sinon');

describe('storages', function () {
  describe('json', function () {
    describe('execute', function () {
      before(function (done) {
        helper
          .prepareMigrations(1, { names: ['123-migration'] })
          .bind(this)
          .then(function () {
            this.migrator = new Migrator({
              migrationsPath: __dirname + '/../tmp/',
              storageOptions: {
                path: __dirname + '/../tmp/migrations.json'
              }
            });
            this.migrate = function () {
              return this
                .migrator
                .execute({ migrations: ['123-migration'], method: 'up' });
            }.bind(this)
          })
          .then(done);
      });

      it('does not execute a migration twice', function (done) {
        var migration = require('../tmp/123-migration.js');
        var upStub    = sinon.stub(migration, 'up', Bluebird.resolve);
        var downStub  = sinon.stub(migration, 'down', Bluebird.resolve);

        this.migrate().bind(this).then(function () {
          return this.migrate();
        }).then(function () {
          expect(upStub.callCount).to.equal(1);
          expect(downStub.callCount).to.equal(0);
        }).then(function () {
          upStub.restore();
          downStub.restore();
        }).then(done);
      });

      it('does not add an executed entry to the storage.json', function (done) {
        var migration = require('../tmp/123-migration.js');
        var upStub    = sinon.stub(migration, 'up', Bluebird.resolve);
        var downStub  = sinon.stub(migration, 'down', Bluebird.resolve);

        this.migrate().bind(this).then(function () {
          return this.migrate();
        }).then(function () {
          var storage = require(this.migrator.options.storageOptions.path);
          expect(storage).to.eql(['123-migration.js']);
        }).then(function () {
          upStub.restore();
          downStub.restore();
        }).then(done);
      });
    });
  });
});
