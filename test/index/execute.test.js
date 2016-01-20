'use strict';

var Bluebird  = require('bluebird');
var expect    = require('expect.js');
var helper    = require('../helper');
var Umzug     = require('../../index');
var sinon     = require('sinon');

describe('Umzug', function () {
  describe('execute', function () {
    describe('without squashes', function () {
      beforeEach(function () {
        return helper
          .prepare({
            migrations: { count: 1, options: { names: ['123-migration'] } }
          })
          .bind(this)
          .then(function () {
            this.migration = require('../tmp/123-migration.js');
            this.upStub    = sinon.stub(this.migration, 'up', Bluebird.resolve);
            this.downStub  = sinon.stub(this.migration, 'down', Bluebird.resolve);
            this.logSpy    = sinon.spy();
            this.umzug     = new Umzug({
              migrations:     { path: __dirname + '/../tmp/' },
              storageOptions: { path: __dirname + '/../tmp/umzug.json' },
              logging:        this.logSpy
            });
            this.migrate = function (method) {
              return this.umzug.execute({
                migrations: ['123-migration'],
                method:     method
              });
            }.bind(this);
          });
      });

      afterEach(function () {
        this.migration.up.restore();
        this.migration.down.restore();
      });

      it('runs the up method of the migration', function () {
        return this
          .migrate('up').bind(this)
          .then(function () {
            expect(this.upStub.callCount).to.equal(1);
            expect(this.downStub.callCount).to.equal(0);
            expect(this.logSpy.callCount).to.equal(2);
            expect(this.logSpy.getCall(0).args[0]).to.equal('== 123-migration: migrating =======');
            expect(this.logSpy.getCall(1).args[0]).to.match(/== 123-migration: migrated \(0\.0\d\ds\)/);
          });
      });

      it('runs the down method of the migration', function () {
        return this
          .migrate('down').bind(this)
          .then(function () {
            expect(this.upStub.callCount).to.equal(0);
            expect(this.downStub.callCount).to.equal(1);
            expect(this.logSpy.callCount).to.equal(2);
            expect(this.logSpy.getCall(0).args[0]).to.equal('== 123-migration: reverting =======');
            expect(this.logSpy.getCall(1).args[0]).to.match(/== 123-migration: reverted \(0\.0\d\ds\)/);
          });
      });

      it('does not execute a migration twice', function () {
        return this.migrate('up').bind(this).then(function () {
          return this.migrate('up');
        }).then(function () {
          expect(this.upStub.callCount).to.equal(1);
          expect(this.downStub.callCount).to.equal(0);
        });
      });

      it('does not add an executed entry to the storage.json', function () {
        return this.migrate('up').bind(this).then(function () {
          return this.migrate('up');
        }).then(function () {
          var storage = require(this.umzug.options.storageOptions.path);
          expect(storage).to.eql(['123-migration.js']);
        });
      });

      it('calls the migration without params by default', function () {
        return this.migrate('up').bind(this).then(function () {
          expect(this.upStub.getCall(0).args).to.eql([]);
        });
      });

      it('calls the migration with the specified params', function () {
        this.umzug.options.migrations.params = [1, 2, 3];

        return this.migrate('up').bind(this).then(function () {
          expect(this.upStub.getCall(0).args).to.eql([1, 2, 3]);
        });
      });

      it('calls the migration with the result of the passed function', function () {
        this.umzug.options.migrations.params = function () {
          return [1, 2, 3];
        };

        return this.migrate('up').bind(this).then(function () {
          expect(this.upStub.getCall(0).args).to.eql([1, 2, 3]);
        });
      });
    });

    describe('with squashes', function () {
      beforeEach(function () {
        return helper
          .prepare({
            migrations: { count: 7},
            squashes:   { count: 4, options: {
              migrations: [
                [ '1-migration.js', '2-migration.js', '3-migration.js' ],
                [ '3-migration.js', '4-migration.js' ],
                [
                  '1-migration.js', '2-migration.js', '3-migration.js',
                  '4-migration.js', '5-migration.js', '6-migration.js',
                  '7-migration.js'
                ],
                [ '5-migration.js', '6-migration.js' ]
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
      it('chooses fully matching squash', function () {
        return this.umzug.execute({
          migrations: this.migrationNames,
          method: 'up'
        }).bind(this)
          .then(function (migrations) {
            expect(migrations).to.have.length(1);
            expect(migrations[0].file).to.equal(this.squashNames[2] + '.js');
          });
      });

      it('chooses squashes and migrations in the correct order', function () {
        return this.umzug.execute({
          migrations: this.migrationNames.slice(0, 6),
          method: 'up'
        }).bind(this)
          .then(function (migrations) {
            expect(migrations).to.have.length(3);
            expect(migrations[0].file).to.equal(this.squashNames[0] + '.js');
            expect(migrations[1].file).to.equal(this.migrationNames[3] + '.js');
            expect(migrations[2].file).to.equal(this.squashNames[3] + '.js');
          });
      });

      it('does not choose overlapping squashes', function () {
        return this.umzug.execute({
          migrations: this.migrationNames.slice(0, 5),
          method: 'up'
        }).bind(this)
          .then(function (migrations) {
            expect(migrations).to.have.length(3);
            expect(migrations[0].file).to.equal(this.squashNames[0] + '.js');
            expect(migrations[1].file).to.equal(this.migrationNames[3] + '.js');
            expect(migrations[2].file).to.equal(this.migrationNames[4] + '.js');
          });
      });

      it('does not choose partially matching squash', function () {
        return this.umzug.execute({
          migrations: this.migrationNames.slice(0, 2),
          method: 'up'
        }).bind(this)
          .then(function (migrations) {
            expect(migrations).to.have.length(2);
            expect(migrations[0].file).to.equal(this.migrationNames[0] + '.js');
            expect(migrations[1].file).to.equal(this.migrationNames[1] + '.js');
          });
      });
    });
  });

  describe('migrations.wrap', function () {
    beforeEach(function () {
      helper.clearTmp();
      require('fs').writeFileSync(__dirname + '/../tmp/123-callback-last-migration.js', [
        '\'use strict\';',
        '',
        'module.exports = {',
        '  up: function (done) {',
        '    setTimeout(done, 200);',
        '  },',
        '  down: function () {}',
        '};'
        ].join('\n')
      );
    });

    it('can be used to handle "callback last" migrations', function () {
      var start = +new Date();
      var umzug = new Umzug({
        migrations: {
          path: __dirname + '/../tmp/',
          wrap: function (fun) {
            if (fun.length === 1) {
              return Bluebird.promisify(fun);
            } else {
              return fun;
            }
          }
        },
        storageOptions: { path: __dirname + '/../tmp/umzug.json' }
      });

      return umzug.execute({
        migrations: ['123-callback-last-migration'],
        method:     'up'
      }).then(function () {
        expect(+new Date() - start).to.be.greaterThan(200);
      });
    });
  });

  describe('coffee-script support', function () {
    beforeEach(function () {
      helper.clearTmp();
      require('fs').writeFileSync(__dirname + '/../tmp/123-coffee-migration.coffee', [
        '\'use strict\'',
        '',
        'module.exports =',
        '  up: () ->',
        '  down: () ->'
        ].join('\n')
      );
    });

    it('runs the migration', function () {
      var umzug = new Umzug({
        migrations: {
          path:    __dirname + '/../tmp/',
          pattern: /\.coffee$/
        },
        storageOptions: {
          path: __dirname + '/../tmp/umzug.json'
        }
      });

      return umzug.execute({
        migrations: ['123-coffee-migration'],
        method:     'up'
      });
    });
  });
});
