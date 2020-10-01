import _path = require('path');
import { MigrationDefinition, ShortMigrationOptions } from './types';

// TODO [>=3.0.0] remove this, use `ShortMigrationOptions` directly in place of `MigrationConstructorOptions`
export interface MigrationConstructorOptions {
	readonly migrations?: ShortMigrationOptions;
}

function isPromise(arg?: any): arg is Promise<any> {
	return arg && typeof arg.then === 'function';
}

export class Migration {
	public readonly file: string;

	constructor(public readonly path: string, private readonly options?: MigrationConstructorOptions) {
		this.path = _path.resolve(path);
		this.options = {
			...options,
			migrations: {
				nameFormatter: (filepath: string) => _path.basename(filepath),
				...options.migrations,
			},
		};

		this.file = this.options.migrations.nameFormatter(this.path);
		if (typeof this.file !== 'string') {
			throw new TypeError(
				`Unexpected migration formatter result for '${this.path}': expected string, got ${typeof this.file}`
			);
		}
	}

	/**
	Obtain the migration definition module, using a custom resolver if present.
	*/
	async migration(): Promise<MigrationDefinition> {
		let result: MigrationDefinition;

		if (typeof this.options.migrations.customResolver === 'function') {
			result = this.options.migrations.customResolver(this.path);
		} else {
			result = require(this.path);
		}

		if (!result) {
			throw new Error(`Failed to obtain migration definition module for '${this.path}'`);
		}

		if (!result.up && !result.down && result.default) {
			result = result.default;
		}

		return result;
	}

	/**
	Executes method `up` of the migration.
	*/
	async up(...args: readonly any[]): Promise<void> {
		await this._exec('up', args);
	}

	/**
	Executes method `down` of the migration.
	*/
	async down(...args: readonly any[]): Promise<void> {
		return this._exec('down', args);
	}

	/**
	Check if migration file name starts with the given string.
	*/
	testFileName(string: string): boolean {
		return this.file.startsWith(this.options.migrations.nameFormatter(string));
	}

	/**
	Executes a given method of migration with given arguments.
	*/
	private async _exec(method: 'up' | 'down', args: readonly any[]): Promise<void> {
		const migration = await this.migration();

		const fn = migration[method];
		if (!fn) {
			throw new Error('Could not find migration method: ' + method);
		}

		const result = this.options.migrations.wrap(fn).apply(migration, args);

		if (!isPromise(result)) {
			throw new Error(`Migration ${this.file} (or wrapper) didn't return a promise`);
		}

		await result;
	}
}
