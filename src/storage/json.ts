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

export class LockableJSONStorage extends JSONStorage implements UmzugStorage {
	private get lockFile() {
		return this.path + '.lock';
	}

	async lock(transactionId: string): Promise<void> {
		const existing = fs.existsSync(this.lockFile) && fs.readFileSync(this.lockFile).toString();
		if (existing) {
			throw new Error(`Can't acquire lock ${transactionId}. ${this.lockFile} exists, transaction id: ${existing}`);
		}

		await this.writeFile(this.lockFile, transactionId);
	}

	async unlock(transactionId?: string): Promise<void> {
		if (!transactionId) {
			await this.removeFile(this.lockFile);
			return;
		}

		const existing = await this.readFile(this.lockFile);
		if (!existing) {
			throw new Error(`Nothing to unlock`);
		}

		if (existing !== transactionId) {
			throw new Error(`Can't unlock ${transactionId}, current lock is ${existing}`);
		}

		await this.removeFile(this.lockFile);
	}
}
