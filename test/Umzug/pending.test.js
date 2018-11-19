import { expect } from 'chai';
import helper from '../helper';
import Migration from '../../src/migration';
import Umzug from '../../src/index';
import { join } from 'path';

const pendingTestSuite = function pendingTestSuite () {
  describe('when no migrations has been executed yet', () => {
    beforeEach(function () {
      return this.umzug.pending().then((migrations) => {
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
      }).then(() => this.umzug.pending()).then((migrations) => {
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
  });

  describe('when storage returns a thenable', () => {
    beforeEach(function () {
      // a migration has been executed already
      return this.umzug.execute({
        migrations: [this.migrationNames[0]],
        method: 'up',
      }).then(() => {
        // storage returns a thenable
        this.umzug.storage = helper.wrapStorageAsCustomThenable(this.umzug.storage);

        return this.umzug.pending();
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
  });
};

describe('pending', () => {
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

  pendingTestSuite();
});

describe('pending-directories', () => {
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

  pendingTestSuite();
});
