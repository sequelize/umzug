import Bluebird from 'bluebird';
import Storage from './Storage';

/**
 * @class RedisStorage
 */
export default class RedisStorage extends Storage {
  /**
   * Constructs Redis storage.
   *
   * @param {Object} [options]
   * @param {String} [options.client] - Redis client
   * see https://github.com/NodeRedis/node_redis
   * @param {String} [options.key] - Key to be used to store list of migrations as a set
   */
  constructor ({ client, key = 'umzug:migrations' } = {}) {
    super();
    this.client = client;
    this.key = key;

    if (!this.client) {
      throw new Error('Redis client is required');
    }

    if (!this.key || typeof this.key !== 'string') {
      throw new Error('Key is a required string');
    }
  }

  /**
   * Logs migration to be considered as executed.
   *
   * @param {String} migrationName - Name of the migration to be logged.
   * @returns {Promise}
   */
  logMigration (migrationName) {
    return Bluebird.promisify(this.client.sadd)
      .call(this.client, this.key, migrationName);
  }

  /**
   * Unlogs migration to be considered as pending.
   *
   * @param {String} migrationName - Name of the migration to be unlogged.
   * @returns {Promise}
   */
  unlogMigration (migrationName) {
    return Bluebird.promisify(this.client.srem)
      .call(this.client, this.key, migrationName);
  }

  /**
   * Gets list of executed migrations.
   *
   * @returns {Promise.<String[]>}
   */
  executed () {
    return Bluebird.promisify(this.client.smembers)
      .call(this.client, this.key);
  }
}
