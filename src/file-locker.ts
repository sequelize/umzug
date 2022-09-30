import fs = require('fs');
import path = require('path');
import type { Umzug } from './umzug';

export type FileLockerOptions = {
	path: string;
	fs?: typeof fs;
};

/**
 * Simple locker using the filesystem. Only one lock can be held per file. An error will be thrown if the
 * lock file already exists.
 *
 * @example
 * const umzug = new Umzug({ ... })
 * FileLocker.attach(umzug, { path: 'path/to/lockfile' })
 *
 * @docs
 * To wait for the lock to be free instead of throwing, you could extend it (the below example uses `setInterval`,
 * but depending on your use-case, you may want to use a library with retry/backoff):
 *
 * @example
 * class WaitingFileLocker extends FileLocker {
 *   async getLock() {
 *     return new Promise(resolve => setInterval(
 *       () => super.getLock().then(resolve).catch(),
 *       500,
 *     )
 *   }
 * }
 *
 * const locker = new WaitingFileLocker({ path: 'path/to/lockfile' })
 * locker.attachTo(umzug)
 */
export class FileLocker {
	private readonly lockFile: string;
	private readonly fs: typeof fs;

	constructor(params: FileLockerOptions) {
		this.lockFile = params.path;
		this.fs = params.fs ?? fs;
	}

	/** Attach `beforeAll` and `afterAll` events to an umzug instance which use the specified filepath */
	static attach(umzug: Umzug, params: FileLockerOptions): void {
		const locker = new FileLocker(params);
		locker.attachTo(umzug);
	}

	/** Attach lock handlers to `beforeCommand` and `afterCommand` events on an umzug instance */
	attachTo(umzug: Umzug): void {
		umzug.on('beforeCommand', async () => this.getLock());
		umzug.on('afterCommand', async () => this.releaseLock());
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

	async getLock(): Promise<void> {
		const existing = await this.readFile(this.lockFile);
		if (existing) {
			throw new Error(`Can't acquire lock. ${this.lockFile} exists`);
		}

		await this.writeFile(this.lockFile, 'lock');
	}

	async releaseLock(): Promise<void> {
		const existing = await this.readFile(this.lockFile);
		if (!existing) {
			throw new Error(`Nothing to unlock`);
		}

		await this.removeFile(this.lockFile);
	}
}
