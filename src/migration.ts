import _path = require('path');
import { MigrationDefinition, ShortMigrationOptions } from './types';

export interface MigrationConstructorOptions {
	readonly migrations?: ShortMigrationOptions;
}

function isPromise(arg?: any): arg is Promise<any> {
	// eslint-disable-next-line promise/prefer-await-to-then
	return arg && typeof arg.then === 'function';
}

export class Migration {
	public readonly file: string;

	/**
	 * Constructs Migration.
	 *
	 * @param {String} path - Path of the migration file.
	 * @param {Object} options
	 * @param {Object} options.migrations
	 * @param {Migration~wrap} options.migrations.wrap - Wrapper function for
	 * migration methods.
	 * @param {Migration~customResolver} [options.migrations.customResolver] - A
	 * function that specifies how to get a migration object from a path. This
	 * should return an object of the form { up: Function, down: Function }.
	 * Without this defined, a regular javascript import will be performed.
	 * @param {Migration~nameFormatter} [options.migrations.nameFormatter] - A
	 * function that receives the file path of the migration and returns the name
	 * of the migration. This can be used to remove file extensions for example.
	 * @constructs Migration
	 */
	constructor(
		public readonly path: string,
		private readonly options?: MigrationConstructorOptions
	) {
		this.path = _path.resolve(path);
		this.options = {
			...options,
			migrations: {
				nameFormatter: (path: string) => _path.basename(path),
				...options.migrations
			}
		};

		this.file = this.options.migrations.nameFormatter(this.path);
		if (typeof this.file !== 'string') {
			throw new TypeError(`Unexpected migration formatter result for '${this.path}': expected string, got ${typeof this.file}`);
		}
	}

	/**
	 * Obtain the migration definition module, using a custom resolver if present.
	 *
	 * @returns {Promise<any>} The migration definition module
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
	 * Executes method `up` of migration.
	 */
	async up(...args: readonly any[]): Promise<void> {
		await this._exec('up', args);
	}

	/**
	 * Executes method `down` of migration.
	 */
	async down(...args: readonly any[]): Promise<void> {
		return this._exec('down', args);
	}

	/**
	 * Check if migration file name is starting with needle.
	 * @param {String} needle - The beginning of the file name.
	 */
	testFileName(needle: string): boolean {
		return this.file.startsWith(this.options.migrations.nameFormatter(needle));
	}

	/**
	 * Executes a given method of migration with given arguments.
	 *
	 * @param {String} method - Name of the method to be called.
	 * @param {*} args - Arguments to be used when called the method.
	 * @returns {Promise}
	 * @private
	 */
	async _exec(method: 'up' | 'down', args: readonly any[]): Promise<void> {
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
