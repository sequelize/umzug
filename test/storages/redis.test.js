import chai, {expect} from 'chai';
import Storage from '../../src/storages/RedisStorage';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';

chai.use(sinonChai);

describe('Redis', function () {
  let redisKey = 'umzug:redis:test';
  let redisClient;

  before(function () {
    redisClient = {
      sadd: sinon.stub().callsFake((key, member, callback) => callback(null)),
      srem: sinon.stub().callsFake((key, member, callback) => callback(null)),
      smembers: sinon.stub().callsFake((key, callback) => callback(null)),
    };
  });

  it('should fail when connection is not set', function () {
    expect(function () {
      new Storage({});
    }).to.throw();
  });

  it('should fail when key is undefined or an object', function () {
    expect(function () {
      new Storage({
        key: undefined,
      });
    }).to.throw();
    expect(function () {
      new Storage({
        key: null,
      });
    }).to.throw();
  });

  describe('logMigration', function () {
    it('should execute "sadd" on redis client', function () {
      let storage = new Storage({client: redisClient, key: redisKey});
      return storage.logMigration('MIGRATION')
        .then(() => {
          expect(redisClient.sadd).to.be.calledWith(redisKey, 'MIGRATION');
        });
    });
  });
  describe('unlogMigration', function () {
    it('should execute "srem" on redis client', function () {
      let storage = new Storage({client: redisClient, key: redisKey});
      return storage.unlogMigration('MIGRATION')
        .then(() => {
          expect(redisClient.srem).to.be.calledWith(redisKey, 'MIGRATION');
        });
    });
  });
  describe('executed', function () {
    it('should execute "smembers" on redis client', function () {
      let storage = new Storage({client: redisClient, key: redisKey});
      return storage.executed()
        .then(migrations => {
          expect(redisClient.smembers.callCount).to.equal(1);
        });
    });
  });
});
