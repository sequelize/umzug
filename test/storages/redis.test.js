import chai, {expect} from 'chai';
import Storage from '../../src/storages/RedisStorage';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import redis from 'redis';

chai.use(sinonChai);

describe('Redis', function () {
  let redisKey = 'umzug:redis:test';
  let redisClient;

  before(function () {
    if (process.env.REDIS_URL) {
      redisClient = redis.createClient();
      sinon.spy(redisClient, 'sadd');
      sinon.spy(redisClient, 'srem');
      sinon.spy(redisClient, 'smembers');
    } else {
      redisClient = {
        sadd: sinon.stub().callsFake((key, member, callback) => callback(null)),
        srem: sinon.stub().callsFake((key, member, callback) => callback(null)),
        smembers: sinon.stub().callsFake((key, callback) => callback(null)),
      };
    }
  });

  after(function (done) {
    if (process.env.REDIS_URL) {
      redisClient.del(redisKey, (...args) => {
        redisClient.end(true);
        done();
      });
    } else {
      done();
    }
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
  describe('test against redis database, pass via REDIS_URL', function () {
    before(function () {
      if (!process.env.REDIS_URL) {
        this.skip();
      }
    });
    it('should hold migration after logging', function () {
      let storage = new Storage({client: redisClient, key: redisKey});
      return storage.logMigration('MIGRATION')
        .then(() => storage.executed())
        .then(migrations => {
          expect(migrations).to.eql(['MIGRATION']);
        });
    });
    it('should hold migration only once after logging it twice', function () {
      let storage = new Storage({client: redisClient, key: redisKey});
      return storage.logMigration('MIGRATION')
        .then(() => storage.executed())
        .then(migrations => {
          expect(migrations).to.eql(['MIGRATION']);
        });
    });
    it('should not hold migration after unlogging', function () {
      let storage = new Storage({client: redisClient, key: redisKey});
      return storage.unlogMigration('MIGRATION')
        .then(() => storage.executed())
        .then(migrations => {
          expect(migrations).to.eql([]);
        });
    });
  });
});
