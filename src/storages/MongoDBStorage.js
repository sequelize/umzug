import _ from 'lodash';
import Storage from './Storage';

/**
 * @class JSONStorage
 */
export default class MongoDBStorage extends Storage {
  /**
     * Constructs MongoDB collection storage.
     *
     * @param {Object} [options]
     * Required either connection and collectionName OR collection
     * @param {String} [options.connection] - a connection to target database established with MongoDB Driver
     * @param {String} [options.collectionName] - name of migration collection in MongoDB
     * @param {String} [options.collection] - reference to a MongoDB Driver collection
     */
  constructor ({connection, collectionName, collection}) {
    super();
    this.connection = connection;
    this.collection = collection;
    this.collectionName = collectionName || 'migrations';

    if (!this.connection && !this.collection) {
      throw new Error('MongoDB Connection or Collection required');
    }

    if (!this.collection) {
      this.collection = this.connection.collection(this.collectionName);
    }
  }

  /**
     * Logs migration to be considered as executed.
     *
     * @param {String} migrationName - Name of the migration to be logged.
     * @returns {Promise}
     */
  logMigration (migrationName) {
    return this.collection.insertOne({migrationName});
  }

  /**
     * Unlogs migration to be considered as pending.
     *
     * @param {String} migrationName - Name of the migration to be unlogged.
     * @returns {Promise}
     */
  unlogMigration (migrationName) {
    return this.collection.removeOne({migrationName});
  }

  /**
     * Gets list of executed migrations.
     *
     * @returns {Promise.<String[]>}
     */
  executed () {
    return this.collection.find({})
      .sort({migrationName: 1})
      .toArray()
      .then((records) => _.map(records, 'migrationName'));
  }
}
