import {promises as fs} from 'fs'
import * as path from 'path'
import type { UmzugStorage } from './contract';

const filesystem = {
	/** reads a file as a string or returns null if file doesn't exist */
	readAsync: async (filepath: string) => {
		return fs.readFile(filepath).then(c => c.toString(), () => null)
	},
	/** writes a string as file contents, creating its parent directory if necessary */
	writeAsync: async (filepath: string, content: string) => {
		await fs.mkdir(path.dirname(filepath), {recursive: true})
		await fs.writeFile(filepath, content)
	}
}

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
		this.path = options?.path ?? path.join(process.cwd(), 'umzug.json');
	}

	async logMigration({ name: migrationName }: { name: string }): Promise<void> {
		const loggedMigrations = await this.executed();
		loggedMigrations.push(migrationName);

		await filesystem.writeAsync(this.path, JSON.stringify(loggedMigrations, null, 2));
	}

	async unlogMigration({ name: migrationName }: { name: string }): Promise<void> {
		const loggedMigrations = await this.executed();
		const updatedMigrations = loggedMigrations.filter(name => name !== migrationName);

		await filesystem.writeAsync(this.path, JSON.stringify(updatedMigrations, null, 2));
	}

	async executed(): Promise<string[]> {
		const content = await filesystem.readAsync(this.path);
		return content ? (JSON.parse(content) as string[]) : [];
	}
}
