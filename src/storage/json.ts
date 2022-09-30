import jetpack = require('fs-jetpack');
import type { UmzugStorage } from './contract';

export type JSONStorageConstructorOptions = {
	/**
	Path to JSON file where the log is stored.

	@default './umzug.json'
	*/
	readonly path?: string;
};

export class JSONStorage implements UmzugStorage {
	public readonly path: string;

	constructor(options?: JSONStorageConstructorOptions) {
		this.path = options?.path ?? jetpack.path(process.cwd(), 'umzug.json');
	}

	async logMigration({ name: migrationName }: { name: string }): Promise<void> {
		const loggedMigrations = await this.executed();
		loggedMigrations.push(migrationName);

		await jetpack.writeAsync(this.path, JSON.stringify(loggedMigrations, null, 2));
	}

	async unlogMigration({ name: migrationName }: { name: string }): Promise<void> {
		const loggedMigrations = await this.executed();
		const updatedMigrations = loggedMigrations.filter(name => name !== migrationName);

		await jetpack.writeAsync(this.path, JSON.stringify(updatedMigrations, null, 2));
	}

	async executed(): Promise<string[]> {
		const content = await jetpack.readAsync(this.path);
		return content ? (JSON.parse(content) as string[]) : [];
	}
}
