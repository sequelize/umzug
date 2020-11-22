import { UmzugStorage } from './contract';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Simple locker using the filesystem. Only one lock can be held per file. An error will be thrown if the
 * lock file already exists.
 *
 * @example
 * const umzug = new Umzug({
 *   migrations: ...,
 *   storage: new FileLockStorage({
 *     parent: new JsonStorage(...),
 *     path: 'path/to/lockfile',
 *   })
 * })
 *
 * @detail
 * To wait for the lock to be free, you could extend it (the below example uses `setInterval`,
 * but depending on your use-case, you may want to use a library with retry/backoff):
 *
 * @example
 * class WaitingFileLockStorage extends FileLockStorage {
 *   async lock(id) {
 *     return new Promise(resolve => setInterval(
 *       () => super.lock(id).then(resolve).catch(),
 *       500,
 *     )
 *   }
 * }
 */
export class FileLockStorage<T extends {}> implements UmzugStorage<T> {
	private readonly lockFile: string;
	private readonly parent: UmzugStorage<T>;
	private readonly fs: typeof fs;

	constructor(params: { parent: UmzugStorage<T>; path: string; fs?: typeof fs }) {
		this.lockFile = params.path;
		this.parent = params.parent;
		this.fs = params.fs ?? fs;
	}

	private async readFile(filepath: string): Promise<string | undefined> {
		return this.fs.promises.readFile(filepath).then(
			buf => buf.toString(),
			() => undefined
		);
	}

	private async writeFile(filepath: string, content: string): Promise<void> {
		await this.fs.promises.mkdir(path.dirname(filepath), { recursive: true });
		await this.fs.promises.writeFile(filepath, content);
	}

	private async removeFile(filepath: string): Promise<void> {
		await this.fs.promises.unlink(filepath);
	}

	async setup(): Promise<void> {
		const existing = await this.readFile(this.lockFile);
		if (existing) {
			throw new Error(`Can't acquire lock. ${this.lockFile} exists`);
		}

		await this.writeFile(this.lockFile, 'lock');
	}

	async teardown(): Promise<void> {
		const existing = await this.readFile(this.lockFile);
		if (!existing) {
			throw new Error(`Nothing to unlock`);
		}

		await this.removeFile(this.lockFile);
	}

	async logMigration(migrationName: string, context: T): Promise<void> {
		await this.parent.logMigration(migrationName, context);
	}

	async unlogMigration(migrationName: string, context: T): Promise<void> {
		await this.parent.unlogMigration(migrationName, context);
	}

	async executed(): Promise<string[]> {
		return this.parent.executed();
	}
}
