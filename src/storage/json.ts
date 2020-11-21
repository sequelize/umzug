// import jetpack = require('fs-jetpack');
import { UmzugStorage } from './contract';
import * as path from 'path';
import * as fs from 'fs';

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
		this.path = options?.path ?? path.join(process.cwd(), 'umzug.json');
	}

	async readFile(filepath: string): Promise<string | undefined> {
		return fs.existsSync(filepath) ? fs.readFileSync(filepath).toString() : undefined;
	}

	async writeFile(filepath: string, content: string): Promise<void> {
		fs.mkdirSync(path.dirname(filepath), { recursive: true });
		fs.writeFileSync(filepath, content);
	}

	async removeFile(filepath: string): Promise<void> {
		fs.unlinkSync(filepath);
	}

	async logMigration(migrationName: string): Promise<void> {
		const loggedMigrations = await this.executed();
		loggedMigrations.push(migrationName);

		await this.writeFile(this.path, JSON.stringify(loggedMigrations, null, 2));
	}

	async unlogMigration(migrationName: string): Promise<void> {
		const loggedMigrations = await this.executed();
		const updatedMigrations = loggedMigrations.filter(name => name !== migrationName);

		await this.writeFile(this.path, JSON.stringify(updatedMigrations, null, 2));
	}

	async executed(): Promise<string[]> {
		const content = await this.readFile(this.path);
		return content ? (JSON.parse(content) as string[]) : [];
	}
}
