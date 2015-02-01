'use strict';

var Bluebird  = require('bluebird');
var expect    = require('expect.js');
var helper    = require('../helper');
var Migration = require('../../lib/migration');
var Umzug     = require('../../index');
var sinon     = require('sinon');

describe('Umzug', function () {
  describe('down', function () {
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
        return this.umzug.down().bind(this).then(function (migrations) {
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
        return this.umzug.execute({
          migrations: [ this.migrationNames[0] ],
          method:     'up'
        }).bind(this).then(function () {
          return this.umzug.executed();
        }).then(function (migrations) {
          expect(migrations).to.have.length(1);
        }).then(function () {
          return this.umzug.down();
        }).then(function (migrations) {
          this.migrations = migrations;
        });
      });

      it('returns 1 item', function () {
        expect(this.migrations).to.have.length(1);
        expect(this.migrations[0].file).to.equal(this.migrationNames[0] + '.js');
      });

      it('removes the reverted migrations from the storage', function () {
        return this.umzug.executed().then(function (migrations) {
          expect(migrations).to.have.length(0);
        });
      });
    });

    describe('when all migrations have been executed already', function () {
      beforeEach(function () {
        return this.umzug.execute({
          migrations: this.migrationNames,
          method:     'up'
        }).bind(this).then(function () {
          return this.umzug.executed();
        }).then(function (migrations) {
          expect(migrations).to.have.length(3);
        });
      });

      describe('when no option is specified', function () {
        beforeEach(function () {
          return this.umzug.down().bind(this).then(function (migrations) {
            this.migrations = migrations;
          });
        });

        it('returns 1 item', function () {
          expect(this.migrations).to.have.length(1);
          expect(this.migrations[0].file).to.equal(this.migrationNames[2] + '.js');
        });

        it('removes the reverted migrations from the storage', function () {
          return this.umzug.executed().bind(this).then(function (migrations) {
            expect(migrations).to.have.length(2);
            expect(migrations[0].file).to.equal(this.migrationNames[0] + '.js');
            expect(migrations[1].file).to.equal(this.migrationNames[1] + '.js');
          });
        });
      });

      describe('when `to` option is passed', function () {
        beforeEach(function () {
          return this.umzug.down({
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
          return this.umzug.executed().bind(this).then(function (migrations) {
            expect(migrations).to.have.length(1);
            expect(migrations[0].file).to.equal(this.migrationNames[0] + '.js');
          });
        });
      });
    });

    describe('when called with a string', function () {
      beforeEach(function () {
        return this.umzug.execute({
          migrations: this.migrationNames,
          method:     'up'
        });
      });

      describe('that matches an executed migration', function () {
        beforeEach(function () {
          return this.umzug.down(this.migrationNames[1]).bind(this)
            .then(function (migrations) { this.migrations = migrations; });
        });

        it('returns only 1 migrations', function () {
          expect(this.migrations).to.have.length(1);
        });

        it('reverts only the second migrations', function () {
          return this.umzug.executed().bind(this).then(function (migrations) {
            expect(migrations).to.have.length(2);
            expect(migrations[0].testFileName(this.migrationNames[0])).to.be.ok();
            expect(migrations[1].testFileName(this.migrationNames[2])).to.be.ok();
          });
        })
      });

      describe('that does not match a migration', function () {
        it('rejects the promise', function () {
          return this.umzug.down('123-asdasd').then(function () {
            return Bluebird.reject('We should not end up here...');
          }, function (err) {
            expect(err.message).to.equal('Unable to find migration: 123-asdasd');
          });
        });
      });

      describe('that does not match an executed migration', function () {
        it('rejects the promise', function () {
          return this.umzug
            .execute({ migrations: this.migrationNames, method: 'down' })
            .bind(this)
            .then(function () {
              return this.umzug.down(this.migrationNames[1]);
            })
            .then(function () {
              return Bluebird.reject('We should not end up here...');
            }, function (err) {
              expect(err.message).to.equal('Migration was not executed: 2-migration.js');
            });
        })
      })
    });

    describe('when called with an array', function () {
      beforeEach(function () {
        return this.umzug.execute({
          migrations: this.migrationNames,
          method:     'up'
        });
      });

      describe('that matches an executed migration', function () {
        beforeEach(function () {
          return this.umzug.down([this.migrationNames[1]]).bind(this)
            .then(function (migrations) { this.migrations = migrations; });
        });

        it('returns only 1 migrations', function () {
          expect(this.migrations).to.have.length(1);
        });

        it('reverts only the second migrations', function () {
          return this.umzug.executed().bind(this).then(function (migrations) {
            expect(migrations).to.have.length(2);
            expect(migrations[0].testFileName(this.migrationNames[0])).to.be.ok();
            expect(migrations[1].testFileName(this.migrationNames[2])).to.be.ok();
          });
        })
      });

      describe('that matches multiple pending migration', function () {
        beforeEach(function () {
          return this.umzug.down(this.migrationNames.slice(1)).bind(this)
            .then(function (migrations) { this.migrations = migrations; });
        });

        it('returns only 2 migrations', function () {
          expect(this.migrations).to.have.length(2);
        });

        it('reverts only the second and the third migrations', function () {
          return this.umzug.executed().bind(this).then(function (migrations) {
            expect(migrations).to.have.length(1);
            expect(migrations[0].testFileName(this.migrationNames[0])).to.be.ok();
          });
        })
      });

      describe('that does not match a migration', function () {
        it('rejects the promise', function () {
          return this.umzug.down(['123-asdasd']).then(function () {
            return Bluebird.reject('We should not end up here...');
          }, function (err) {
            expect(err.message).to.equal('Unable to find migration: 123-asdasd');
          });
        });
      });

      describe('that does not match an executed migration', function () {
        it('rejects the promise', function () {
          return this.umzug
            .execute({ migrations: this.migrationNames, method: 'down' })
            .bind(this)
            .then(function () {
              return this.umzug.down([this.migrationNames[1]]);
            })
            .then(function () {
              return Bluebird.reject('We should not end up here...');
            }, function (err) {
              expect(err.message).to.equal('Migration was not executed: 2-migration.js');
            });
        });
      });

      describe('that does partially not match an executed migration', function () {
        it('rejects the promise', function () {
          return this.umzug
            .execute({ migrations: this.migrationNames.slice(0, 2), method: 'down' })
            .bind(this)
            .then(function () {
              return this.umzug.down(this.migrationNames.slice(1));
            })
            .then(function () {
              return Bluebird.reject('We should not end up here...');
            }, function (err) {
              expect(err.message).to.equal('Migration was not executed: 2-migration.js');
            });
        });
      });
    });

    describe('when storage returns a thenable', function() {

      beforeEach(function() {

        //a migration has been executed already...
        return this.umzug.execute({
          migrations: [ this.migrationNames[0] ],
          method:     'up'
        }).bind(this).then(function () {
          return this.umzug.executed();
        }).then(function (migrations) {
          expect(migrations).to.have.length(1);
        }).then(function () {

          //storage returns a thenable
          this.umzug.storage = helper.wrapStorageAsCustomThenable(this.umzug.storage);

          return this.umzug.down();
        }).then(function (migrations) {
          this.migrations = migrations;
        });

      });

      it('returns 1 item', function () {
        expect(this.migrations).to.have.length(1);
        expect(this.migrations[0].file).to.equal(this.migrationNames[0] + '.js');
      });

      it('removes the reverted migrations from the storage', function () {
        return this.umzug.executed().then(function (migrations) {
          expect(migrations).to.have.length(0);
        });
      });

    });
  });
});
