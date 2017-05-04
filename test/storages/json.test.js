import { expect } from 'chai';
import fs from 'fs';
import helper from '../helper';
import path from 'path';
import Storage from '../../src/storages/json';

describe('JSON', function () {
  beforeEach(function() {
    helper.clearTmp();
  });

  describe('constructor', function () {
    it('stores options', function () {
      var storage = new Storage();
      expect(storage).to.have.property('path');
    });

    it('sets the default storage path', function () {
      var storage = new Storage();
      expect(storage.path).to.equal(
        path.normalize(process.cwd() + '/umzug.json')
      );
    });
  });

  describe('logMigration', function () {
    beforeEach(function () {
      this.path    = __dirname + '/../tmp/umzug.json';
      this.storage = new Storage({ path: this.path });
      return helper.prepareMigrations(3);
    });

    it('creates a new file if not exists yet', function () {
      expect(fs.existsSync(this.path)).to.not.be.ok;
      return this.storage.logMigration('asd.js').then(() => {
        expect(fs.existsSync(this.path)).to.be.ok;
      });
    });

    it('adds the passed value to the storage', function () {
      return this.storage.logMigration('asd.js').then(() => {
        return helper.promisify(fs.readFile)(this.path);
      }).then((content) => {
        return JSON.parse(content);
      }).then((data) => {
        expect(data).to.eql(['asd.js']);
      });
    });
  });

  describe('unlogMigration', function () {
    beforeEach(function () {
      this.path    = __dirname + '/../tmp/umzug.json';
      this.storage = new Storage({ path: this.path });
      return helper.prepareMigrations(3);
    });

    it('removes the passed value from the storage', function () {
      var read = () => {
        return helper
          .promisify(fs.readFile)(this.path)
          .then((content) => {
            return JSON.parse(content);
          });
      };

      return this.storage.logMigration('foo.js').then(() => {
        return this.storage.logMigration('bar.js');
      })
      .then(read)
      .then((data) => {
        expect(data).to.eql([ 'foo.js', 'bar.js' ]);
      })
      .then(() => {
        return this.storage.unlogMigration('foo.js');
      })
      .then(read)
      .then((data) => {
        expect(data).to.eql([ 'bar.js' ]);
      });
    });
  });

  describe('executed', function () {
    beforeEach(function () {
      this.path    = __dirname + '/../tmp/umzug.json';
      this.storage = new Storage({ path: this.path });
      return helper.prepareMigrations(3);
    });

    it('returns an empty array if no migrations were logged yet', function () {
      return this.storage.executed().then((data) => {
        expect(data).to.eql([]);
      });
    });

    it('returns executed migrations', function () {
      return this.storage.logMigration('foo.js').then(() => {
        return this.storage.executed();
      }).then((data) => {
        expect(data).to.eql([ 'foo.js' ]);
      });
    });
  });
});
