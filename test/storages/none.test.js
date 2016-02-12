'use strict';

var expect    = require('expect.js');
var helper    = require('../helper');
var Storage   = require('../../lib/storages/none');

describe('none', function () {
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
      return this.storage.executed().then(function (data) {
        expect(data).to.eql([]);
      });
    });

    it('returns an empty array even if migrations were executed', function () {
      return this.storage.logMigration('foo.js').bind(this).then(function () {
        return this.storage.executed();
      }).then(function (data) {
        expect(data).to.eql([]);
      });
    });
  });
});
