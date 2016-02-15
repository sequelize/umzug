'use strict';

var Bluebird  = require('bluebird');
var expect    = require('expect.js');
var fs        = require('fs');
var helper    = require('../helper');
var path      = require('path');
var Storage   = require('../../lib/storages/json');

describe('JSON', function () {
  describe('constructor', function () {
    it('stores options', function () {
      var storage = new Storage();
      expect(storage).to.have.property('options');
    });

    it('sets the default storage path', function () {
      var storage = new Storage();
      expect(storage.options.storageOptions.path).to.equal(
        path.normalize(process.cwd() + '/umzug.json')
      );
    });
  });

  describe('logMigration', function () {
    beforeEach(function () {
      this.path    = __dirname + '/../tmp/umzug.json';
      this.storage = new Storage({
        storageOptions: { path: this.path }
      });
      return helper.prepareMigrations(3);
    });

    it('creates a new file if not exists yet', function () {
      expect(fs.existsSync(this.path)).to.not.be.ok();
      return this.storage.logMigration('asd.js').bind(this).then(function () {
        expect(fs.existsSync(this.path)).to.be.ok();
      });
    });

    it('adds the passed value to the storage', function () {
      return this.storage.logMigration('asd.js').bind(this).then(function () {
        return Bluebird.promisify(fs.readFile)(this.path);
      }).then(function (content) {
        return JSON.parse(content);
      }).then(function (data) {
        expect(data).to.eql(['asd.js']);
      });
    });
  });

  describe('unlogMigration', function () {
    beforeEach(function () {
      this.path    = __dirname + '/../tmp/umzug.json';
      this.storage = new Storage({
        storageOptions: { path: this.path }
      });
      return helper.prepareMigrations(3);
    });

    it('removes the passed value from the storage', function () {
      var read = function () {
        return Bluebird
          .promisify(fs.readFile)(this.path)
          .then(function (content) {
            return JSON.parse(content);
          });
      }.bind(this);

      return this.storage.logMigration('foo.js').bind(this).then(function () {
        return this.storage.logMigration('bar.js');
      })
      .then(read)
      .then(function (data) {
        expect(data).to.eql([ 'foo.js', 'bar.js' ]);
      })
      .then(function () {
        return this.storage.unlogMigration('foo.js');
      })
      .then(read)
      .then(function (data) {
        expect(data).to.eql([ 'bar.js' ]);
      });
    });
  });

  describe('executed', function () {
    beforeEach(function () {
      this.path    = __dirname + '/../tmp/umzug.json';
      this.storage = new Storage({
        storageOptions: { path: this.path }
      });
      return helper.prepareMigrations(3);
    });

    it('returns an empty array if no migrations were logged yet', function () {
      return this.storage.executed().then(function (data) {
        expect(data).to.eql([]);
      });
    });

    it('returns executed migrations', function () {
      return this.storage.logMigration('foo.js').bind(this).then(function () {
        return this.storage.executed();
      }).then(function (data) {
        expect(data).to.eql([ 'foo.js' ]);
      });
    });
  });
});
