import Bluebird from 'bluebird';

/**
 * @class Storage
 */
export default class Storage {
  /**
   * Does nothing.
   *
   * @param {String} migrationName - Name of migration to be logged.
   * @returns {Promise}
   */
  logMigration (migrationName) {
    return Bluebird.resolve();
  }

  /**
   * Does nothing.
   *
   * @param {String} migrationName - Name of migration to unlog.
   * @returns {Promise}
   */
  unlogMigration (migrationName) {
    return Bluebird.resolve();
  }

  /**
   * Does nothing.
   *
   * @returns {Promise.<String[]>}
   */
  executed () {
    return Bluebird.resolve([]);
  }
}
