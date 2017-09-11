import chai, {expect} from 'chai';
import helper from '../helper';
import Storage from '../../src/storages/MongoDBStorage';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
chai.use(sinonChai);

describe('MongoDB', function () {
  let connectionApi;
  let collectionApi;

  beforeEach(function () {
    helper.clearTmp();
    collectionApi = {
      insertOne: sinon.stub().resolves(),
      removeOne: sinon.stub().resolves(),
      find: sinon.stub().returns({
        sort: sinon.stub().returns({
          toArray: sinon.stub().resolves([]),
        }),
      }),
    };
    connectionApi = {collection: sinon.stub().returns(collectionApi)};
  });

  describe('constructor', function () {
    it('should fail when connection is not set', function () {
      expect(function () {
        new Storage({});
      }).to.throw();
    });
    describe('stores options', function () {
      it('-> connection', function () {
        let storage = new Storage({connection: connectionApi});
        expect(storage.connection).to.equal(connectionApi);
      });
      it('-> collection', function () {
        let storage = new Storage({collection: collectionApi});
        expect(storage.collection).to.equal(collectionApi);
      });
      it('-> collectionName', function () {
        let storage = new Storage({connection: connectionApi, collectionName: 'TEST'});
        expect(storage.collectionName).to.equal('TEST');
      });
      it('-> collectionName (default)', function () {
        let storage = new Storage({connection: connectionApi});
        expect(storage.collectionName).to.equal('migrations');
      });
    });
  });

  describe('logMigration', function () {
    beforeEach(function () {
      this.storage = new Storage({collection: collectionApi});
      return helper.prepareMigrations(3);
    });

    it('adds the passed value to the storage', function () {
      return this.storage.logMigration('asd.js').then(() => {
        expect(collectionApi.insertOne).to.have.been.calledWith({migrationName: 'asd.js'});
      });
    });
  });

  describe('unlogMigration', function () {
    beforeEach(function () {
      this.storage = new Storage({collection: collectionApi});
      return helper.prepareMigrations(3);
    });

    it('removes the passed value from the storage', function () {
      return this.storage.unlogMigration('asd.js').then(() => {
        expect(collectionApi.removeOne).to.have.been.calledWith({migrationName: 'asd.js'});
      });
    });
  });

  describe('executed', function () {
    beforeEach(function () {
      this.storage = new Storage({collection: collectionApi});
      return helper.prepareMigrations(3);
    });

    it('returns an empty array if no migrations were logged yet', function () {
      return this.storage.executed().then((data) => {
        expect(data).to.eql([]);
      });
    });
  });
});
