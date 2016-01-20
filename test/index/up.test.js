'use strict';

var Bluebird  = require('bluebird');
var expect    = require('expect.js');
var helper    = require('../helper');
var Migration = require('../../lib/migration');
var Umzug     = require('../../index');

describe('Umzug', function () {
  describe('up', function () {
    describe('without squashes', function () {
      beforeEach(function () {
        return helper
          .prepare({
            migrations: { count: 3 }
          })
          .bind(this)
          .spread(function (migrationNames) {
            this.migrationNames = migrationNames;
            this.umzug = new Umzug({
              migrations:     { path: __dirname + '/../tmp/' },
              storageOptions: { path: __dirname + '/../tmp/umzug.json' }
            });
          });
      });

      describe('when no migrations has been executed yet', function () {
        beforeEach(function () {
          return this.umzug.up().bind(this).then(function (migrations) {
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
            expect(migration.migrations()).to.be.an(Array);
            expect(migration.migrations()).to.have.length(1);
          });
        });
      });

      describe('when a migration has been executed already', function () {
        beforeEach(function () {
          return this.umzug.execute({
            migrations: [this.migrationNames[0]],
            method: 'up'
          }).bind(this).then(function () {
            return this.umzug.up();
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

        it('adds the two missing migrations to the storage', function () {
          return this.umzug.executed().then(function (migrations) {
            expect(migrations).to.have.length(3);
          });
        });
      });

      describe('when passing the `to` option', function () {
        beforeEach(function () {
          return this.umzug.up({
            to: this.migrationNames[1]
          }).bind(this).then(function (migrations) {
            this.migrations = migrations;
          });
        });

        it('returns only 2 migrations', function () {
          expect(this.migrations).to.have.length(2);
          expect(this.migrations[0].file).to.equal(this.migrationNames[0] + '.js');
          expect(this.migrations[1].file).to.equal(this.migrationNames[1] + '.js');
        });

        it('executed only the first 2 migrations', function () {
          return this.umzug.executed().then(function (migrations) {
            expect(migrations).to.have.length(2);
          });
        });

        it('did not execute the third migration', function () {
          return this.umzug.executed()
            .bind(this).then(function (migrations) {
              var migrationFiles = migrations.map(function (migration) {
                return migration.file;
              });
              expect(migrationFiles).to.not.contain(this.migrationNames[2]);
            });
        });

        describe('that does not match a migration', function () {
          it('rejects the promise', function () {
            return this.umzug.up({to: '123-asdasd'}).then(function () {
              return Bluebird.reject('We should not end up here...');
            }, function (err) {
              expect(err.message).to.equal('Unable to find migration: 123-asdasd');
            });
          });
        });

        describe('that does not match a pending migration', function () {
          it('rejects the promise', function () {
            return this.umzug
              .execute({migrations: this.migrationNames, method: 'up'})
              .bind(this)
              .then(function () {
                return this.umzug.up({to: this.migrationNames[1]});
              })
              .then(function () {
                return Bluebird.reject('We should not end up here...');
              }, function (err) {
                expect(err.message).to.equal('Migration is not pending: 2-migration.js');
              });
          });
        });
      });

      describe('when called with a string', function () {
        describe('that matches a pending migration', function () {
          beforeEach(function () {
            return this.umzug.up(this.migrationNames[1]).bind(this)
              .then(function (migrations) {
                this.migrations = migrations;
              });
          });

          it('returns only 1 migration', function () {
            expect(this.migrations).to.have.length(1);
            expect(this.migrations[0].file).to.equal(this.migrationNames[1] + '.js');
          });

          it('executed only the second migrations', function () {
            return this.umzug.executed().bind(this).then(function (migrations) {
              expect(migrations).to.have.length(1);
              expect(migrations[0].testFileName(this.migrationNames[1])).to.be.ok();
            });
          });
        });

        describe('that does not match a migration', function () {
          it('rejects the promise', function () {
            return this.umzug.up('123-asdasd').then(function () {
              return Bluebird.reject('We should not end up here...');
            }, function (err) {
              expect(err.message).to.equal('Unable to find migration: 123-asdasd');
            });
          });
        });

        describe('that does not match a pending migration', function () {
          it('rejects the promise', function () {
            return this.umzug
              .execute({migrations: this.migrationNames, method: 'up'})
              .bind(this)
              .then(function () {
                return this.umzug.up(this.migrationNames[1]);
              })
              .then(function () {
                return Bluebird.reject('We should not end up here...');
              }, function (err) {
                expect(err.message).to.equal('Migration is not pending: 2-migration.js');
              });
          });
        });
      });

      describe('when called with an array', function () {
        describe('that matches a pending migration', function () {
          beforeEach(function () {
            return this.umzug.up([this.migrationNames[1]]).bind(this)
              .then(function (migrations) {
                this.migrations = migrations;
              });
          });

          it('returns only 1 migration', function () {
            expect(this.migrations).to.have.length(1);
            expect(this.migrations[0].file).to.equal(this.migrationNames[1] + '.js');
          });

          it('executed only the second migrations', function () {
            return this.umzug.executed().bind(this).then(function (migrations) {
              expect(migrations).to.have.length(1);
              expect(migrations[0].testFileName(this.migrationNames[1])).to.be.ok();
            });
          });
        });

        describe('that matches multiple pending migration', function () {
          beforeEach(function () {
            return this.umzug.up(this.migrationNames.slice(1)).bind(this)
              .then(function (migrations) {
                this.migrations = migrations;
              });
          });

          it('returns only 2 migrations', function () {
            expect(this.migrations).to.have.length(2);
            expect(this.migrations[0].file).to.equal(this.migrationNames[1] + '.js');
            expect(this.migrations[1].file).to.equal(this.migrationNames[2] + '.js');
          });

          it('executed only the second and the third migrations', function () {
            return this.umzug.executed().bind(this).then(function (migrations) {
              expect(migrations).to.have.length(2);
              expect(migrations[0].testFileName(this.migrationNames[1])).to.be.ok();
              expect(migrations[1].testFileName(this.migrationNames[2])).to.be.ok();
            });
          });
        });

        describe('that does not match a migration', function () {
          it('rejects the promise', function () {
            return this.umzug.up(['123-asdasd']).then(function () {
              return Bluebird.reject('We should not end up here...');
            }, function (err) {
              expect(err.message).to.equal('Unable to find migration: 123-asdasd');
            });
          });
        });

        describe('that does not match a pending migration', function () {
          it('rejects the promise', function () {
            return this.umzug
              .execute({migrations: this.migrationNames, method: 'up'})
              .bind(this)
              .then(function () {
                return this.umzug.up([this.migrationNames[1]]);
              })
              .then(function () {
                return Bluebird.reject('We should not end up here...');
              }, function (err) {
                expect(err.message).to.equal('Migration is not pending: 2-migration.js');
              });
          });
        });

        describe('that does partially not match a pending migration', function () {
          it('rejects the promise', function () {
            return this.umzug
              .execute({
                migrations: this.migrationNames.slice(0, 2),
                method: 'up'
              })
              .bind(this)
              .then(function () {
                return this.umzug.up(this.migrationNames.slice(1));
              })
              .then(function () {
                return Bluebird.reject('We should not end up here...');
              }, function (err) {
                expect(err.message).to.equal('Migration is not pending: 2-migration.js');
              });
          });
        });
      });

      describe('when storage returns a thenable', function () {
        beforeEach(function () {

          //one migration has been executed already
          return this.umzug.execute({
            migrations: [this.migrationNames[0]],
            method: 'up'
          }).bind(this).then(function () {

            //storage returns a thenable
            this.umzug.storage = helper.wrapStorageAsCustomThenable(this.umzug.storage);

            return this.umzug.up();
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

        it('adds the two missing migrations to the storage', function () {
          return this.umzug.executed().then(function (migrations) {
            expect(migrations).to.have.length(3);
          });
        });
      });
    });

    describe('with squashes', function () {
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
            this.umzug = new Umzug({
              migrations:     { path: __dirname + '/../tmp/' },
              squashes:       { path: __dirname + '/../tmp/squashes/' },
              storageOptions: { path: __dirname + '/../tmp/umzug.json' }
            });
          });
      });

      describe('when no migrations has been executed yet', function () {
        beforeEach(function () {
          return this.umzug.up().bind(this).then(function (migrations) {
            this.migrations = migrations;
          });
        });

        it('returns an array', function () {
          expect(this.migrations).to.be.an(Array);
        });

        it('returns 1 squash', function () {
          expect(this.migrations).to.have.length(1);
          expect(this.migrations[0].file).to.equal(this.squashNames[2] + '.js');
        });
      });

      describe('when a migration has been executed already', function () {
        beforeEach(function () {
          return this.umzug.execute({
            migrations: [this.migrationNames[0]],
            method: 'up'
          }).bind(this).then(function () {
            return this.umzug.up();
          }).then(function (migrations) {
            this.migrations = migrations;
          });
        });

        it('returns only 1 squash', function () {
          expect(this.migrations).to.have.length(1);
          expect(this.migrations[0].file).to.equal(this.squashNames[1] + '.js');
        });

        it('adds the two missing migrations to the storage', function () {
          return this.umzug.executed().then(function (migrations) {
            expect(migrations).to.have.length(3);
          });
        });
      });

      describe('when passing the `to` option', function () {
        beforeEach(function () {
          return this.umzug.up({
            to: this.migrationNames[1]
          }).bind(this).then(function (migrations) {
            this.migrations = migrations;
          });
        });

        it('returns only 1 squash', function () {
          expect(this.migrations).to.have.length(1);
          expect(this.migrations[0].file).to.equal(this.squashNames[0] + '.js');
        });

        it('executed only the first 2 migrations', function () {
          return this.umzug.executed().then(function (migrations) {
            expect(migrations).to.have.length(2);
          });
        });

        it('did not execute the third migration', function () {
          return this.umzug.executed()
            .bind(this).then(function (migrations) {
              var migrationFiles = migrations.map(function (migration) {
                return migration.file;
              });
              expect(migrationFiles).to.not.contain(this.migrationNames[2]);
            });
        });

        describe('that does not match a migration', function () {
          it('rejects the promise', function () {
            return this.umzug.up({to: '123-asdasd'}).then(function () {
              return Bluebird.reject('We should not end up here...');
            }, function (err) {
              expect(err.message).to.equal('Unable to find migration: 123-asdasd');
            });
          });
        });

        describe('that does not match a pending migration', function () {
          it('rejects the promise', function () {
            return this.umzug
              .execute({migrations: this.migrationNames, method: 'up'})
              .bind(this)
              .then(function () {
                return this.umzug.up({to: this.migrationNames[1]});
              })
              .then(function () {
                return Bluebird.reject('We should not end up here...');
              }, function (err) {
                expect(err.message).to.equal('Migration is not pending: 2-migration.js');
              });
          });
        });
      });

      describe('when called with a string', function () {
        describe('that matches a pending migration', function () {
          beforeEach(function () {
            return this.umzug.up(this.migrationNames[1]).bind(this)
              .then(function (migrations) {
                this.migrations = migrations;
              });
          });

          it('returns only 1 migrations', function () {
            expect(this.migrations).to.have.length(1);
            expect(this.migrations[0].file).to.equal(this.migrationNames[1] + '.js');
          });

          it('executed only the second migrations', function () {
            return this.umzug.executed().bind(this).then(function (migrations) {
              expect(migrations).to.have.length(1);
              expect(migrations[0].testFileName(this.migrationNames[1])).to.be.ok();
            });
          });
        });

        describe('that does not match a migration', function () {
          it('rejects the promise', function () {
            return this.umzug.up('123-asdasd').then(function () {
              return Bluebird.reject('We should not end up here...');
            }, function (err) {
              expect(err.message).to.equal('Unable to find migration: 123-asdasd');
            });
          });
        });

        describe('that does not match a pending migration', function () {
          it('rejects the promise', function () {
            return this.umzug
              .execute({migrations: this.migrationNames, method: 'up'})
              .bind(this)
              .then(function () {
                return this.umzug.up(this.migrationNames[1]);
              })
              .then(function () {
                return Bluebird.reject('We should not end up here...');
              }, function (err) {
                expect(err.message).to.equal('Migration is not pending: 2-migration.js');
              });
          });
        });
      });

      describe('when called with an array', function () {
        describe('that matches a pending migration', function () {
          beforeEach(function () {
            return this.umzug.up([this.migrationNames[1]]).bind(this)
              .then(function (migrations) {
                this.migrations = migrations;
              });
          });

          it('returns only 1 migration', function () {
            expect(this.migrations).to.have.length(1);
            expect(this.migrations[0].file).to.equal(this.migrationNames[1] + '.js');
          });

          it('executed only the second migrations', function () {
            return this.umzug.executed().bind(this).then(function (migrations) {
              expect(migrations).to.have.length(1);
              expect(migrations[0].testFileName(this.migrationNames[1])).to.be.ok();
            });
          });
        });

        describe('that matches multiple pending migration', function () {
          beforeEach(function () {
            return this.umzug.up(this.migrationNames.slice(1)).bind(this)
              .then(function (migrations) {
                this.migrations = migrations;
              });
          });

          it('returns only 1 squash', function () {
            expect(this.migrations).to.have.length(1);
            expect(this.migrations[0].file).to.equal(this.squashNames[1] + '.js');
          });

          it('executed only the second and the third migrations', function () {
            return this.umzug.executed().bind(this).then(function (migrations) {
              expect(migrations).to.have.length(2);
              expect(migrations[0].testFileName(this.migrationNames[1])).to.be.ok();
              expect(migrations[1].testFileName(this.migrationNames[2])).to.be.ok();
            });
          });
        });

        describe('that does not match a migration', function () {
          it('rejects the promise', function () {
            return this.umzug.up(['123-asdasd']).then(function () {
              return Bluebird.reject('We should not end up here...');
            }, function (err) {
              expect(err.message).to.equal('Unable to find migration: 123-asdasd');
            });
          });
        });

        describe('that does not match a pending migration', function () {
          it('rejects the promise', function () {
            return this.umzug
              .execute({migrations: this.migrationNames, method: 'up'})
              .bind(this)
              .then(function () {
                return this.umzug.up([this.migrationNames[1]]);
              })
              .then(function () {
                return Bluebird.reject('We should not end up here...');
              }, function (err) {
                expect(err.message).to.equal('Migration is not pending: 2-migration.js');
              });
          });
        });

        describe('that does partially not match a pending migration', function () {
          it('rejects the promise', function () {
            return this.umzug
              .execute({
                migrations: this.migrationNames.slice(0, 2),
                method: 'up'
              })
              .bind(this)
              .then(function () {
                return this.umzug.up(this.migrationNames.slice(1));
              })
              .then(function () {
                return Bluebird.reject('We should not end up here...');
              }, function (err) {
                expect(err.message).to.equal('Migration is not pending: 2-migration.js');
              });
          });
        });
      });

      describe('when storage returns a thenable', function () {
        beforeEach(function () {
          //one migration has been executed already
          return this.umzug.execute({
            migrations: [this.migrationNames[0]],
            method: 'up'
          }).bind(this).then(function () {

            //storage returns a thenable
            this.umzug.storage = helper.wrapStorageAsCustomThenable(this.umzug.storage);

            return this.umzug.up();
          }).then(function (migrations) {
            this.migrations = migrations;
          });
        });

        it('returns only 1 squash', function () {
          expect(this.migrations).to.have.length(1);
          expect(this.migrations[0].file).to.equal(this.squashNames[1] + '.js');
        });

        it('adds the two missing migrations to the storage', function () {
          return this.umzug.executed().then(function (migrations) {
            expect(migrations).to.have.length(3);
          });
        });
      });
    });
  });
});
