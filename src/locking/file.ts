import * as path from 'path';
import { UmzugLocker } from './contract';
import * as _fs from 'fs';

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
