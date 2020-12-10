import jetpack = require('fs-jetpack');
import { MigrationParams } from '../types';
import { StorableMigration, UmzugStorage } from './contract';

export interface JSONStorageConstructorOptions {
	/**
	Path to JSON file where the log is stored.

	@default './umzug.json'
	*/
	readonly path?: string;
}

export class JSONStorage implements UmzugStorage {
	public readonly path: string;

	constructor(options?: JSONStorageConstructorOptions) {
		this.path = options?.path ?? jetpack.path(process.cwd(), 'umzug.json');
	}

	async logMigration(migrationName: string, { batch }: MigrationParams<{}>): Promise<void> {
		const loggedMigrations = await this.executed();
		loggedMigrations.push({ name: migrationName, batch });

		await jetpack.writeAsync(this.path, JSON.stringify(loggedMigrations, null, 2));
	}

	async unlogMigration(migrationName: string): Promise<void> {
		const loggedMigrations = await this.executed();
		const updatedMigrations = loggedMigrations.filter(({ name }) => name !== migrationName);

		await jetpack.writeAsync(this.path, JSON.stringify(updatedMigrations, null, 2));
	}

	async executed(): Promise<StorableMigration[]> {
		const content = await jetpack.readAsync(this.path);
		const executed = content ? (JSON.parse(content) as Array<string | StorableMigration>) : [];
		return executed.map<StorableMigration>(e => (typeof e === 'string' ? { name: e } : e));
	}
}
