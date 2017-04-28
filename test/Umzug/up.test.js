import { expect } from 'chai';
import helper from '../helper';
import Migration from '../../src/migration';
import Umzug from '../../src/index';

describe('up', function () {
  beforeEach(function () {
    helper.clearTmp();
    return helper
      .prepareMigrations(3)
      .then((migrationNames) => {
        this.migrationNames = migrationNames;
        this.umzug          = new Umzug({
          migrations:     { path: __dirname + '/../tmp/' },
          storageOptions: { path: __dirname + '/../tmp/umzug.json' }
        });
      });
  });

  describe('when no migrations has been executed yet', function () {
    beforeEach(function () {
      return this.umzug.up().then((migrations) => {
        this.migrations = migrations;
      });
    });

    it('returns an array', function () {
      expect(this.migrations).to.be.an('array');
    });

    it('returns 3 items', function () {
      expect(this.migrations).to.have.length(3);
    });

    it('returns migration instances', function () {
      this.migrations.forEach((migration) => {
        expect(migration).to.be.an.instanceof(Migration);
      });
    });
  });

  describe('when a migration has been executed already', function () {
    beforeEach(function () {
      return this.umzug.execute({
        migrations: [ this.migrationNames[0] ],
        method:     'up'
      }).then(() => {
        return this.umzug.up();
      }).then((migrations) => {
        this.migrations = migrations;
      });
    });

    it('returns only 2 items', function () {
      expect(this.migrations).to.have.length(2);
    });

    it('returns only the migrations that have not been run yet', function () {
      var self = this;

      this.migrationNames.slice(1).forEach((migrationName, i) => {
        expect(self.migrations[i].file).to.equal(migrationName + '.js');
      });
    });

    it('adds the two missing migrations to the storage', function () {
      return this.umzug.executed().then((migrations) => {
        expect(migrations).to.have.length(3);
      });
    });
  });


  describe('when passing the `from` option', function () {
    describe('UP method', function () {
      beforeEach(function () {
        return this.umzug.up({
          from: this.migrationNames[1],
        }).then((migrations) => {
          this.migrations = migrations;
        });
      });
      it('should return 1 migration', function () {
        expect(this.migrations).to.have.length(1);
      });
      it('should be the last migration', function() {
        expect(this.migrations[0].file).to.equal('3-migration.js');
      });
    });
  });

  describe('when passing the `to` option', function () {
    beforeEach(function () {
      return this.umzug.up({
        to: this.migrationNames[1]
      }).then((migrations) => {
        this.migrations = migrations;
      });
    });

    it('returns only 2 migrations', function () {
      expect(this.migrations).to.have.length(2);
    });

    it('executed only the first 2 migrations', function () {
      return this.umzug.executed().then((migrations) => {
        expect(migrations).to.have.length(2);
      });
    });

    it('did not execute the third migration', function () {
      return this.umzug.executed()
        .then((migrations) => {
          var migrationFiles = migrations.map((migration) => {
            return migration.file;
          });
          expect(migrationFiles).to.not.contain(this.migrationNames[2]);
        });
    });

    describe('that does not match a migration', function () {
      it('rejects the promise', function () {
        return this.umzug.up({ to: '123-asdasd' }).then(() => {
          return Promise.reject('We should not end up here...');
        }, (err) => {
          expect(err.message).to.equal('Unable to find migration: 123-asdasd');
        });
      });
    });

    describe('that does not match a pending migration', function () {
      it('rejects the promise', function () {
        return this.umzug
          .execute({ migrations: this.migrationNames, method: 'up' })
          .then(() => {
            return this.umzug.up({ to: this.migrationNames[1] });
          })
          .then(() => {
            return Promise.reject('We should not end up here...');
          }, (err) => {
            expect(err.message).to.equal('Migration is not pending: 2-migration.js');
          });
      });
    });
  });

  describe('when called with a string', function () {
    describe('that matches a pending migration', function () {
      beforeEach(function () {
        return this.umzug.up(this.migrationNames[1])
          .then((migrations) => { this.migrations = migrations; });
      });

      it('returns only 1 migrations', function () {
        expect(this.migrations).to.have.length(1);
      });

      it('executed only the second migrations', function () {
        return this.umzug.executed().then((migrations) => {
          expect(migrations).to.have.length(1);
          expect(migrations[0].testFileName(this.migrationNames[1])).to.be.ok;
        });
      });
    });

    describe('that does not match a migration', function () {
      it('rejects the promise', function () {
        return this.umzug.up('123-asdasd').then(() => {
          return Promise.reject('We should not end up here...');
        }, (err) => {
          expect(err.message).to.equal('Unable to find migration: 123-asdasd');
        });
      });
    });

    describe('that does not match a pending migration', function () {
      it('rejects the promise', function () {
        return this.umzug
          .execute({ migrations: this.migrationNames, method: 'up' })
          .then(() => {
            return this.umzug.up(this.migrationNames[1]);
          })
          .then(() => {
            return Promise.reject('We should not end up here...');
          }, (err) => {
            expect(err.message).to.equal('Migration is not pending: 2-migration.js');
          });
      });
    });
  });

  describe('when called with an array', function () {
    describe('that matches a pending migration', function () {
      beforeEach(function () {
        return this.umzug.up([this.migrationNames[1]])
          .then((migrations) => { this.migrations = migrations; });
      });

      it('returns only 1 migrations', function () {
        expect(this.migrations).to.have.length(1);
      });

      it('executed only the second migrations', function () {
        return this.umzug.executed().then((migrations) => {
          expect(migrations).to.have.length(1);
          expect(migrations[0].testFileName(this.migrationNames[1])).to.be.ok;
        });
      });
    });

    describe('that matches multiple pending migration', function () {
      beforeEach(function () {
        return this.umzug.up(this.migrationNames.slice(1))
          .then((migrations) => { this.migrations = migrations; });
      });

      it('returns only 2 migrations', function () {
        expect(this.migrations).to.have.length(2);
      });

      it('executed only the second and the third migrations', function () {
        return this.umzug.executed().then((migrations) => {
          expect(migrations).to.have.length(2);
          expect(migrations[0].testFileName(this.migrationNames[1])).to.be.ok;
          expect(migrations[1].testFileName(this.migrationNames[2])).to.be.ok;
        });
      });
    });

    describe('that does not match a migration', function () {
      it('rejects the promise', function () {
        return this.umzug.up(['123-asdasd']).then(() => {
          return Promise.reject('We should not end up here...');
        }, (err) => {
          expect(err.message).to.equal('Unable to find migration: 123-asdasd');
        });
      });
    });

    describe('that does not match a pending migration', function () {
      it('rejects the promise', function () {
        return this.umzug
          .execute({ migrations: this.migrationNames, method: 'up' })
          .then(() => {
            return this.umzug.up([this.migrationNames[1]]);
          })
          .then(() => {
            return Promise.reject('We should not end up here...');
          }, (err) => {
            expect(err.message).to.equal('Migration is not pending: 2-migration.js');
          });
      });
    });

    describe('that does partially not match a pending migration', function () {
      it('rejects the promise', function () {
        return this.umzug
          .execute({ migrations: this.migrationNames.slice(0, 2), method: 'up' })
          .then(() => {
            return this.umzug.up(this.migrationNames.slice(1));
          })
          .then(() => {
            return Promise.reject('We should not end up here...');
          }, (err) => {
            expect(err.message).to.equal('Migration is not pending: 2-migration.js');
          });
      });
    });
  });

  describe('when storage returns a thenable', function () {
    beforeEach(function () {

      //one migration has been executed already
      return this.umzug.execute({
        migrations: [ this.migrationNames[0] ],
        method:     'up'
      }).then(() => {

        //storage returns a thenable
        this.umzug.storage = helper.wrapStorageAsCustomThenable(this.umzug.storage);

        return this.umzug.up();
      }).then((migrations) => {
        this.migrations = migrations;
      });
    });

    it('returns only 2 items', function () {
      expect(this.migrations).to.have.length(2);
    });

    it('returns only the migrations that have not been run yet', function () {
      var self = this;

      this.migrationNames.slice(1).forEach((migrationName, i) => {
        expect(self.migrations[i].file).to.equal(migrationName + '.js');
      });
    });

    it('adds the two missing migrations to the storage', function () {
      return this.umzug.executed().then((migrations) => {
        expect(migrations).to.have.length(3);
      });
    });
  });
});
