import _ from 'lodash';
import Bluebird from 'bluebird';
import Storage from './Storage';

/**
 * @class JSONStorage
 */
export default class MongoDBStorage extends Storage {
    /**
     * Constructs MongoDB file storage.
     *
     * @param {Object} [options]
     * @param {String} [options.path='./umzug.json'] - Path to JSON file where
     * the log is stored. Defaults './umzug.json' relative to process' cwd.
     */
    constructor({connection, collection, collectionName}) {
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
    logMigration(migrationName) {
        return this.collection.insertOne({migrationName});
    }

    /**
     * Unlogs migration to be considered as pending.
     *
     * @param {String} migrationName - Name of the migration to be unlogged.
     * @returns {Promise}
     */
    unlogMigration(migrationName) {
        return this.collection.removeOne({migrationName});
    }

    /**
     * Gets list of executed migrations.
     *
     * @returns {Promise.<String[]>}
     */
    executed() {
        return this.collection.find({})
            .sort({migrationName: 1})
            .toArray()
            .then((records) => _.map(records, 'migrationName'));
    }
}
