import { expect } from 'chai';
import helper from '../helper';
import Umzug from '../../src/index';
import { join } from 'path';

const downTestSuite = function downTestSuite () {
  describe('when no migrations has been executed yet', () => {
    beforeEach(function () {
      return this.umzug.down().then((migrations) => {
        this.migrations = migrations;
      });
    });

    it('returns an array', function () {
      expect(this.migrations).to.be.an('array');
    });

    it('returns 0 items', function () {
      expect(this.migrations).to.have.length(0);
    });
  });

  describe('when a migration has been executed already', () => {
    beforeEach(function () {
      return this.umzug.execute({
        migrations: [this.migrationNames[0]],
        method: 'up',
      }).then(() => this.umzug.executed()).then((migrations) => {
        expect(migrations).to.have.length(1);
      }).then(() => this.umzug.down()).then((migrations) => {
        this.migrations = migrations;
      });
    });

    it('returns 1 item', function () {
      expect(this.migrations).to.have.length(1);
      expect(this.migrations[0].file).to.equal(this.migrationNames[0] + '.js');
    });

    it('removes the reverted migrations from the storage', function () {
      return this.umzug.executed().then((migrations) => {
        expect(migrations).to.have.length(0);
      });
    });
  });

  describe('when all migrations have been executed already', () => {
    beforeEach(function () {
      return this.umzug.execute({
        migrations: this.migrationNames,
        method: 'up',
      }).then(() => this.umzug.executed()).then((migrations) => {
        expect(migrations).to.have.length(3);
      });
    });

    describe('when no option is specified', () => {
      beforeEach(function () {
        return this.umzug.down().then((migrations) => {
          this.migrations = migrations;
        });
      });

      it('returns 1 item', function () {
        expect(this.migrations).to.have.length(1);
        expect(this.migrations[0].file).to.equal(this.migrationNames[2] + '.js');
      });

      it('removes the reverted migrations from the storage', function () {
        return this.umzug.executed().then((migrations) => {
          expect(migrations).to.have.length(2);
          expect(migrations[0].file).to.equal(this.migrationNames[0] + '.js');
          expect(migrations[1].file).to.equal(this.migrationNames[1] + '.js');
        });
      });
    });

    describe('when empty options is specified', () => {
      beforeEach(function () {
        return this.umzug.down({}).then((migrations) => {
          this.migrations = migrations;
        });
      });

      it('returns 1 item', function () {
        expect(this.migrations).to.have.length(1);
        expect(this.migrations[0].file).to.equal(this.migrationNames[2] + '.js');
      });

      it('removes the reverted migrations from the storage', function () {
        return this.umzug.executed().then((migrations) => {
          expect(migrations).to.have.length(2);
          expect(migrations[0].file).to.equal(this.migrationNames[0] + '.js');
          expect(migrations[1].file).to.equal(this.migrationNames[1] + '.js');
        });
      });
    });

    describe('when `from` option is passed', () => {
      beforeEach(function () {
        return this.umzug.down({
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

    describe('when `to` option is passed', () => {
      beforeEach(function () {
        return this.umzug.down({
          to: this.migrationNames[1],
        }).then((migrations) => {
          this.migrations = migrations;
        });
      });

      it('returns 2 item', function () {
        expect(this.migrations).to.have.length(2);
        expect(this.migrations[0].file).to.equal(this.migrationNames[2] + '.js');
        expect(this.migrations[1].file).to.equal(this.migrationNames[1] + '.js');
      });

      it('removes the reverted migrations from the storage', function () {
        return this.umzug.executed().then((migrations) => {
          expect(migrations).to.have.length(1);
          expect(migrations[0].file).to.equal(this.migrationNames[0] + '.js');
        });
      });

      describe('that does not match a migration', () => {
        it('rejects the promise', function () {
          return this.umzug.down({ to: '123-asdasd' }).then(() => Promise.reject(new Error('We should not end up here...')), (err) => {
            expect(err.message).to.equal('Unable to find migration: 123-asdasd');
          });
        });
      });

      describe('that does not match an executed migration', () => {
        it('rejects the promise', function () {
          return this.umzug
            .execute({ migrations: this.migrationNames, method: 'down' })
            .then(() => this.umzug.down({ to: this.migrationNames[1] }))
            .then(() => Promise.reject(new Error('We should not end up here...')), (err) => {
              expect(err.message).to.equal('Migration was not executed: 2-migration.js');
            });
        });
      });
    });
  });

  describe('when called with a string', () => {
    beforeEach(function () {
      return this.umzug.execute({
        migrations: this.migrationNames,
        method: 'up',
      });
    });

    describe('that matches an executed migration', () => {
      beforeEach(function () {
        return this.umzug.down(this.migrationNames[1])
          .then((migrations) => {
            this.migrations = migrations;
          });
      });

      it('returns only 1 migrations', function () {
        expect(this.migrations).to.have.length(1);
      });

      it('reverts only the second migrations', function () {
        return this.umzug.executed().then((migrations) => {
          expect(migrations).to.have.length(2);
          expect(migrations[0].testFileName(this.migrationNames[0])).to.be.ok;
          expect(migrations[1].testFileName(this.migrationNames[2])).to.be.ok;
        });
      });
    });

    describe('that does not match a migration', () => {
      it('rejects the promise', function () {
        return this.umzug.down('123-asdasd').then(() => Promise.reject(new Error('We should not end up here...')), (err) => {
          expect(err.message).to.equal('Unable to find migration: 123-asdasd');
        });
      });
    });

    describe('that does not match an executed migration', () => {
      it('rejects the promise', function () {
        return this.umzug
          .execute({ migrations: this.migrationNames, method: 'down' })
          .then(() => this.umzug.down(this.migrationNames[1]))
          .then(() => Promise.reject(new Error('We should not end up here...')), (err) => {
            expect(err.message).to.equal('Migration was not executed: 2-migration.js');
          });
      });
    });
  });

  describe('when called with an array', () => {
    beforeEach(function () {
      return this.umzug.execute({
        migrations: this.migrationNames,
        method: 'up',
      });
    });

    describe('that matches an executed migration', () => {
      beforeEach(function () {
        return this.umzug.down([this.migrationNames[1]])
          .then((migrations) => {
            this.migrations = migrations;
          });
      });

      it('returns only 1 migrations', function () {
        expect(this.migrations).to.have.length(1);
      });

      it('reverts only the second migrations', function () {
        return this.umzug.executed().then((migrations) => {
          expect(migrations).to.have.length(2);
          expect(migrations[0].testFileName(this.migrationNames[0])).to.be.ok;
          expect(migrations[1].testFileName(this.migrationNames[2])).to.be.ok;
        });
      });
    });

    describe('that matches multiple pending migration', () => {
      beforeEach(function () {
        return this.umzug.down(this.migrationNames.slice(1))
          .then((migrations) => {
            this.migrations = migrations;
          });
      });

      it('returns only 2 migrations', function () {
        expect(this.migrations).to.have.length(2);
      });

      it('reverts only the second and the third migrations', function () {
        return this.umzug.executed().then((migrations) => {
          expect(migrations).to.have.length(1);
          expect(migrations[0].testFileName(this.migrationNames[0])).to.be.ok;
        });
      });
    });

    describe('that does not match a migration', () => {
      it('rejects the promise', function () {
        return this.umzug.down(['123-asdasd']).then(() => Promise.reject(new Error('We should not end up here...')), (err) => {
          expect(err.message).to.equal('Unable to find migration: 123-asdasd');
        });
      });
    });

    describe('that does not match an executed migration', () => {
      it('rejects the promise', function () {
        return this.umzug
          .execute({ migrations: this.migrationNames, method: 'down' })
          .then(() => this.umzug.down([this.migrationNames[1]]))
          .then(() => Promise.reject(new Error('We should not end up here...')), (err) => {
            expect(err.message).to.equal('Migration was not executed: 2-migration.js');
          });
      });
    });

    describe('that does partially not match an executed migration', () => {
      it('rejects the promise', function () {
        return this.umzug
          .execute({ migrations: this.migrationNames.slice(0, 2), method: 'down' })
          .then(() => this.umzug.down(this.migrationNames.slice(1)))
          .then(() => Promise.reject(new Error('We should not end up here...')), (err) => {
            expect(err.message).to.equal('Migration was not executed: 2-migration.js');
          });
      });
    });
  });

  describe('when storage returns a thenable', () => {
    beforeEach(function () {
      // a migration has been executed already...
      return this.umzug.execute({
        migrations: [this.migrationNames[0]],
        method: 'up',
      }).then(() => this.umzug.executed()).then((migrations) => {
        expect(migrations).to.have.length(1);
      }).then(() => {
        // storage returns a thenable
        this.umzug.storage = helper.wrapStorageAsCustomThenable(this.umzug.storage);

        return this.umzug.down();
      }).then((migrations) => {
        this.migrations = migrations;
      });
    });

    it('returns 1 item', function () {
      expect(this.migrations).to.have.length(1);
      expect(this.migrations[0].file).to.equal(this.migrationNames[0] + '.js');
    });

    it('removes the reverted migrations from the storage', function () {
      return this.umzug.executed().then((migrations) => {
        expect(migrations).to.have.length(0);
      });
    });
  });
};

describe('down', () => {
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

  downTestSuite();
});

describe('down-directories', () => {
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

  downTestSuite();
});
