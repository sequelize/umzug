const { expect } = require('chai');
const helper = require('../helper');
const Storage = require('../../src/storages/Storage');

describe('none', () => {
  beforeEach(() => {
    helper.clearTmp();
  });

  describe('constructor', () => {
    it('stores no options', () => {
      const storage = new Storage();
      expect(storage).to.not.have.property('options');
    });
  });

  describe('executed', () => {
    beforeEach(function () {
      this.storage = new Storage();
      return helper.prepareMigrations(3);
    });

    it('returns an empty array', function () {
      return this.storage.executed().then((data) => {
        expect(data).to.eql([]);
      });
    });

    it('returns an empty array even if migrations were executed', function () {
      return this.storage.logMigration('foo.js').then(() => this.storage.executed()).then((data) => {
        expect(data).to.eql([]);
      });
    });
  });
});
