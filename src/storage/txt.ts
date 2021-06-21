import jetpack = require('fs-jetpack');
import { UmzugStorage } from './contract';

const SEPARATOR = '\n';

export interface TXTStorageConstructorOptions {
	/**
	Path to JSON file where the log is stored.

	@default './umzug.txt'
	*/
	readonly path?: string;
}

export class TXTStorage implements UmzugStorage {
	public readonly path: string;

	constructor(options?: TXTStorageConstructorOptions) {
		this.path = options?.path ?? jetpack.path(process.cwd(), 'umzug.txt');
	}

	async logMigration({ name }: { name: string }): Promise<void> {
		const seeds = await this.executed();
		return jetpack.writeAsync(this.path, [...seeds, name, ''].join(SEPARATOR));
	}

	async unlogMigration({ name }: { name: string }): Promise<void> {
		const seeds = await this.executed();
		const newContent = [...seeds.filter(seedName => seedName !== name), ''].join(SEPARATOR);

		return jetpack.writeAsync(this.path, newContent);
	}

	async executed(): Promise<string[]> {
		const content = await jetpack.readAsync(this.path);
		const seeds = content ? content.split(SEPARATOR).filter(name => name !== '') : [];

		return seeds;
	}
}
