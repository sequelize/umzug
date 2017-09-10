import _ from 'lodash';
import Bluebird from 'bluebird';
import fs from 'fs';
import _path from 'path';
import Storage from './Storage';

/**
 * @class JSONStorage
 */
export default class JSONStorage extends Storage {
  /**
   * Constructs JSON file storage.
   *
   * @param {Object} [options]
   * @param {String} [options.path='./umzug.json'] - Path to JSON file where
   * the log is stored. Defaults './umzug.json' relative to process' cwd.
   */
  constructor ({ path = _path.resolve(process.cwd(), 'umzug.json') } = {}) {
    super();
    this.path = path;
  }

  /**
   * Logs migration to be considered as executed.
   *
   * @param {String} migrationName - Name of the migration to be logged.
   * @returns {Promise}
   */
  logMigration (migrationName) {
    let filePath = this.path;
    let readfile = Bluebird.promisify(fs.readFile);
    let writefile = Bluebird.promisify(fs.writeFile);

    return readfile(filePath)
      .catch(function () { return '[]'; })
      .then(function (content) { return JSON.parse(content); })
      .then(function (content) {
        content.push(migrationName);
        return writefile(filePath, JSON.stringify(content, null, '  '));
      });
  }

  /**
   * Unlogs migration to be considered as pending.
   *
   * @param {String} migrationName - Name of the migration to be unlogged.
   * @returns {Promise}
   */
  unlogMigration (migrationName) {
    let filePath = this.path;
    let readfile = Bluebird.promisify(fs.readFile);
    let writefile = Bluebird.promisify(fs.writeFile);

    return readfile(filePath)
      .catch(function () { return '[]'; })
      .then(function (content) { return JSON.parse(content); })
      .then(function (content) {
        content = _.without(content, migrationName);
        return writefile(filePath, JSON.stringify(content, null, '  '));
      });
  }

  /**
   * Gets list of executed migrations.
   *
   * @returns {Promise.<String[]>}
   */
  executed () {
    let filePath = this.path;
    let readfile = Bluebird.promisify(fs.readFile);

    return readfile(filePath)
      .catch(function () { return '[]'; })
      .then(function (content) {
        return JSON.parse(content);
      });
  }
}
