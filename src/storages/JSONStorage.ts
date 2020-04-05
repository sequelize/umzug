import jetpack = require('fs-jetpack');
import { Storage } from './Storage';

export interface JSONStorageConstructorOptions {
	readonly path?: string;
}

/**
 * @class JSONStorage
 */
export class JSONStorage extends Storage {
	public readonly path?: string;

	/**
	 * Constructs JSON file storage.
	 *
	 * @param {Object} [options]
	 * @param {String} [options.path='./umzug.json'] - Path to JSON file where
	 * the log is stored. Defaults './umzug.json' relative to process' cwd.
	 */
	constructor(options?: JSONStorageConstructorOptions) {
		super();
		this.path = options?.path ?? jetpack.path(process.cwd(), 'umzug.json');
	}

	/**
	 * Logs migration to be considered as executed.
	 *
	 * @param {string} migrationName - Name of the migration to be logged.
	 */
	async logMigration(migrationName: string): Promise<void> {
		const loggedMigrations = await this.executed();
		loggedMigrations.push(migrationName);

		await jetpack.writeAsync(this.path, JSON.stringify(loggedMigrations, null, 2));
	}

	/**
	 * Unlogs migration to be considered as pending.
	 *
	 * @param {string} migrationName - Name of the migration to be unlogged.
	 */
	async unlogMigration(migrationName: string): Promise<void> {
		const loggedMigrations = await this.executed();
		const updatedMigrations = loggedMigrations.filter(name => name !== migrationName);

		await jetpack.writeAsync(this.path, JSON.stringify(updatedMigrations, null, 2));
	}

	/**
	 * Gets list of executed migrations.
	 */
	async executed(): Promise<string[]> {
		const content = await jetpack.readAsync(this.path);
		return content ? (JSON.parse(content) as string[]) : [];
	}
}
