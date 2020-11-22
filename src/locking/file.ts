import * as path from 'path';
import { UmzugLocker } from './contract';
import * as _fs from 'fs';

/**
 * Simple locker using the filesystem. Only one lock can be held per file. An error will be thrown if the
 * lock file already exists.
 *
 * @example
 * const umzug = new Umzug({
 *   migrations: ...,
 *   storage: addLocker(
 *     new JsonStorage(...),
 *     new FileLocker('path/to/lockfile')
 *   )
 * })
 *
 * @detail
 * To wait for the lock to be free, you could extend it (the below example uses `setInterval`,
 * but depending on your use-case, you may want to use a library with retry/backoff):
 *
 * @example
 * class WaitingFileLocker extends FileLocker {
 *   async lock(id) {
 *     return new Promise(resolve => setInterval(
 *       () => super.lock(id).then(resolve).catch(),
 *       500,
 *     )
 *   }
 * }
 */
export class FileLocker implements UmzugLocker {
	constructor(readonly lockFile: string, readonly fs = _fs) {}

	async readFile(filepath: string): Promise<string | undefined> {
		return this.fs.promises.readFile(filepath).then(
			buf => buf.toString(),
			() => undefined
		);
	}

	async writeFile(filepath: string, content: string): Promise<void> {
		await this.fs.promises.mkdir(path.dirname(filepath), { recursive: true });
		await this.fs.promises.writeFile(filepath, content);
	}

	async removeFile(filepath: string): Promise<void> {
		await this.fs.promises.unlink(filepath);
	}

	async lock(id: string): Promise<void> {
		const existing = await this.readFile(this.lockFile);
		if (existing) {
			throw new Error(`Can't acquire lock ${id}. ${this.lockFile} exists with id: ${existing}`);
		}

		await this.writeFile(this.lockFile, id);
	}

	async unlock(id: string): Promise<void> {
		if (!id) {
			await this.removeFile(this.lockFile);
			return;
		}

		const existing = await this.readFile(this.lockFile);
		if (!existing) {
			throw new Error(`Nothing to unlock`);
		}

		if (existing !== id) {
			throw new Error(`Can't unlock ${id}, current lock is ${existing}`);
		}

		await this.removeFile(this.lockFile);
	}
}
