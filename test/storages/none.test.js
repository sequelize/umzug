import { expect } from 'chai';
import helper from '../helper';
import Storage from '../../src/storages/none';

describe('none', function () {
  beforeEach(function() {
    helper.clearTmp();
  });

  describe('constructor', function () {
    it('stores no options', function () {
      var storage = new Storage();
      expect(storage).to.not.have.property('options');
    });
  });

  describe('executed', function () {
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
      return this.storage.logMigration('foo.js').then(() => {
        return this.storage.executed();
      }).then((data) => {
        expect(data).to.eql([]);
      });
    });
  });
});
