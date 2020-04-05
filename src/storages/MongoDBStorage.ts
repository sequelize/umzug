import { UmzugStorage } from './type-helpers/umzug-storage';

type AnyObject = { [key: string]: any };

export interface MongoDBConnectionOptions {
	/**
	A connection to target database established with MongoDB Driver
	*/
	readonly connection: AnyObject;

	/**
	The name of the migration collection in MongoDB

	@default 'migrations'
	*/
	readonly collectionName?: string;
}

export interface MongoDBCollectionOptions {
	/**
	A reference to a MongoDB Driver collection
	*/
	readonly collection: AnyObject;
}

export type MongoDBStorageConstructorOptions = MongoDBConnectionOptions | MongoDBCollectionOptions;

function isMongoDBCollectionOptions(arg: any): arg is MongoDBCollectionOptions {
	return Boolean(arg?.collection);
}

export class MongoDBStorage implements UmzugStorage {
	public readonly collection: AnyObject;
	public readonly connection: any; // TODO remove this
	public readonly collectionName: string; // TODO remove this

	constructor(options: MongoDBStorageConstructorOptions) {
		if (!options || (!(options as any).collection && !(options as any).connection)) {
			throw new Error('MongoDB Connection or Collection required');
		}

		if (isMongoDBCollectionOptions(options)) {
			this.collection = options.collection;
		} else {
			this.collection = options.connection.collection(options.collectionName ?? 'migrations');
		}

		this.connection = (options as any).connection; // TODO remove this
		this.collectionName = (options as any).collectionName ?? 'migrations'; // TODO remove this
	}

	async logMigration(migrationName: string): Promise<void> {
		await this.collection.insertOne({ migrationName });
	}

	async unlogMigration(migrationName: string): Promise<void> {
		await this.collection.removeOne({ migrationName });
	}

	async executed(): Promise<string[]> {
		type Record = { migrationName: string };
		const records: Record[] = await this.collection.find({}).sort({ migrationName: 1 }).toArray();
		return records.map(r => r.migrationName);
	}
}
