import { expect } from 'chai';
import helper from '../helper';
import Migration from '../../src/migration';
import Umzug from '../../src';
import { join } from 'path';

const upTestuite = function upTestuite () {
  describe('when no migrations has been executed yet', () => {
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

  describe('when a migration has been executed already', () => {
    beforeEach(function () {
      return this.umzug.execute({
        migrations: [this.migrationNames[0]],
        method: 'up',
      }).then(() => this.umzug.up()).then((migrations) => {
        this.migrations = migrations;
      });
    });

    it('returns only 2 items', function () {
      expect(this.migrations).to.have.length(2);
    });

    it('returns only the migrations that have not been run yet', function () {
      const self = this;

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

  describe('when passing the `from` option', () => {
    describe('UP method', () => {
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
      it('should be the last migration', function () {
        expect(this.migrations[0].file).to.equal('3-migration.js');
      });
    });
  });

  describe('when passing the `to` option', () => {
    beforeEach(function () {
      return this.umzug.up({
        to: this.migrationNames[1],
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
          const migrationFiles = migrations.map((migration) => migration.file);
          expect(migrationFiles).to.not.contain(this.migrationNames[2]);
        });
    });

    describe('that does not match a migration', () => {
      it('rejects the promise', function () {
        return this.umzug.up({ to: '123-asdasd' }).then(() => Promise.reject(new Error('We should not end up here...')), (err) => {
          expect(err.message).to.equal('Unable to find migration: 123-asdasd');
        });
      });
    });

    describe('that does not match a pending migration', () => {
      it('rejects the promise', function () {
        return this.umzug
          .execute({ migrations: this.migrationNames, method: 'up' })
          .then(() => this.umzug.up({ to: this.migrationNames[1] }))
          .then(() => Promise.reject(new Error('We should not end up here...')), (err) => {
            expect(err.message).to.equal('Migration is not pending: 2-migration.js');
          });
      });
    });
  });

  describe('when called with a string', () => {
    describe('that matches a pending migration', () => {
      beforeEach(function () {
        return this.umzug.up(this.migrationNames[1])
          .then((migrations) => {
            this.migrations = migrations;
          });
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

    describe('that does not match a migration', () => {
      it('rejects the promise', function () {
        return this.umzug.up('123-asdasd').then(() => Promise.reject(new Error('We should not end up here...')), (err) => {
          expect(err.message).to.equal('Unable to find migration: 123-asdasd');
        });
      });
    });

    describe('that does not match a pending migration', () => {
      it('rejects the promise', function () {
        return this.umzug
          .execute({ migrations: this.migrationNames, method: 'up' })
          .then(() => this.umzug.up(this.migrationNames[1]))
          .then(() => Promise.reject(new Error('We should not end up here...')), (err) => {
            expect(err.message).to.equal('Migration is not pending: 2-migration.js');
          });
      });
    });
  });

  describe('when called with an array', () => {
    describe('that matches a pending migration', () => {
      beforeEach(function () {
        return this.umzug.up([this.migrationNames[1]])
          .then((migrations) => {
            this.migrations = migrations;
          });
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

    describe('that matches multiple pending migration', () => {
      beforeEach(function () {
        return this.umzug.up(this.migrationNames.slice(1))
          .then((migrations) => {
            this.migrations = migrations;
          });
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

    describe('that does not match a migration', () => {
      it('rejects the promise', function () {
        return this.umzug.up(['123-asdasd']).then(() => Promise.reject(new Error('We should not end up here...')), (err) => {
          expect(err.message).to.equal('Unable to find migration: 123-asdasd');
        });
      });
    });

    describe('that does not match a pending migration', () => {
      it('rejects the promise', function () {
        return this.umzug
          .execute({ migrations: this.migrationNames, method: 'up' })
          .then(() => this.umzug.up([this.migrationNames[1]]))
          .then(() => Promise.reject(new Error('We should not end up here...')), (err) => {
            expect(err.message).to.equal('Migration is not pending: 2-migration.js');
          });
      });
    });

    describe('that does partially not match a pending migration', () => {
      it('rejects the promise', function () {
        return this.umzug
          .execute({ migrations: this.migrationNames.slice(0, 2), method: 'up' })
          .then(() => this.umzug.up(this.migrationNames.slice(1)))
          .then(() => Promise.reject(new Error('We should not end up here...')), (err) => {
            expect(err.message).to.equal('Migration is not pending: 2-migration.js');
          });
      });
    });
  });

  describe('when storage returns a thenable', () => {
    beforeEach(function () {
      // one migration has been executed already
      return this.umzug.execute({
        migrations: [this.migrationNames[0]],
        method: 'up',
      }).then(() => {
        // storage returns a thenable
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
      const self = this;

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
};

describe('up', () => {
  beforeEach(function () {
    helper.clearTmp();
    return helper
      .prepareMigrations(3)
      .then((migrationNames) => {
        this.migrationNames = migrationNames;
        this.umzug = new Umzug({
          migrations: { path: join(__dirname, '/../tmp/') },
          storageOptions: { path: join(__dirname, '/../tmp/umzug.json') },
        });
      });
  });

  upTestuite();
});

describe('up-directories', () => {
  beforeEach(function () {
    helper.clearTmp();
    return helper
      .prepareMigrations(3, { directories: [['1', '2'], ['1', '2'], ['1', '3', '4', '5']] })
      .then((migrationNames) => {
        this.migrationNames = migrationNames;
        this.umzug = new Umzug({
          migrations: { path: join(__dirname, '/../tmp/'), traverseDirectories: true },
          storageOptions: { path: join(__dirname, '/../tmp/umzug.json') },
        });
      });
  });

  upTestuite();
});
