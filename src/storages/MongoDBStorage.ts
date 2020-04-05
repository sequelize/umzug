import { Storage } from './Storage';

export interface MongoDBStorageConstructorOptions {
	readonly connection: any;
	readonly collectionName?: string;
	readonly collection: any;
}

/**
 * @class MongoDBStorage
 */
export class MongoDBStorage extends Storage {
	public readonly connection: any;
	public readonly collectionName?: string;
	public readonly collection: any;

	/**
	 * Constructs MongoDB collection storage.
	 *
	 * @param {Object} [options]
	 * Required either connection and collectionName OR collection
	 * @param {String} [options.connection] - a connection to target database established with MongoDB Driver
	 * @param {String} [options.collectionName] - name of migration collection in MongoDB
	 * @param {String} [options.collection] - reference to a MongoDB Driver collection
	 */
	constructor(options: MongoDBStorageConstructorOptions) {
		super();

		this.connection = options.connection;
		this.collection = options.collection;
		this.collectionName = options.collectionName || 'migrations';

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
	 */
	async logMigration(migrationName: string): Promise<void> {
		await this.collection.insertOne({ migrationName });
	}

	/**
	 * Unlogs migration to be considered as pending.
	 *
	 * @param {String} migrationName - Name of the migration to be unlogged.
	 */
	async unlogMigration(migrationName: string): Promise<void> {
		await this.collection.removeOne({ migrationName });
	}

	/**
	 * Gets list of executed migrations.
	 */
	async executed(): Promise<string[]> {
		type Record = { migrationName: string };
		const records: Record[] = await this.collection.find({}).sort({ migrationName: 1 }).toArray();
		return records.map(r => r.migrationName);
	}
}
