import _ from 'lodash';
import fs from 'fs';
import { promisify } from '../helper';
import Storage from './Storage';

const readfile = promisify(fs.readFile);
const writefile = promisify(fs.writeFile);

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
  constructor({ path = `${process.cwd()}/umzug.json` } = {}) {
    super();
    this.path = path;
  }

  /**
   * Logs migration to be considered as executed.
   *
   * @param {String} migrationName - Name of the migration to be logged.
   * @returns {Promise}
   */
   async logMigration(migrationName) {
     const executed = await this.executed();
     const content = [...executed, migrationName];
     const result = JSON.stringify(content, null, '  ');
     await writefile(this.path, result);
  }

  /**
   * Unlogs migration to be considered as pending.
   *
   * @param {String} migrationName - Name of the migration to be unlogged.
   * @returns {Promise}
   */
   async unlogMigration(migrationName) {
     const executed = await this.executed();
     const content = _.without(executed, migrationName);
     const result = JSON.stringify(content, null, '  ');
     await writefile(this.path, result);
  }

  /**
   * Gets list of executed migrations.
   *
   * @returns {Promise.<String[]>}
   */
   async executed() {
     const content = await readfile(this.path).catch(() => '[]');
     return JSON.parse(content);
  }
}
