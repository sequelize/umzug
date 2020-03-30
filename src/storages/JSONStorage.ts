import Bluebird = require('bluebird');
import _path = require('path');
import fs = require('fs');
import { Storage } from './Storage';

export interface JSONStorageConstructorOptions {
	readonly path?: string;
}

/**
 * @class JSONStorage
 */
export class JSONStorage extends Storage {
	public readonly path?: string;

	/**
	 * Constructs JSON file storage.
	 *
	 * @param {Object} [options]
	 * @param {String} [options.path='./umzug.json'] - Path to JSON file where
	 * the log is stored. Defaults './umzug.json' relative to process' cwd.
	 */
	constructor (options?: JSONStorageConstructorOptions) {
		super();
		this.path = (options && options.path) ?? _path.resolve(process.cwd(), 'umzug.json');
	}

	/**
	 * Logs migration to be considered as executed.
	 *
	 * @param {String} migrationName - Name of the migration to be logged.
	 * @returns {Promise}
	 */
	logMigration (migrationName) {
		const filePath = this.path;
		const readfile = Bluebird.promisify(fs.readFile);
		const writefile = Bluebird.promisify(fs.writeFile);

		return readfile(filePath)
			.catch(() => '[]')
			.then((content) => JSON.parse(content))
			.then((content) => {
				content.push(migrationName);
				return writefile(filePath, JSON.stringify(content, null, '  '));
			});
	}

	/**
	 * Unlogs migration to be considered as pending.
	 *
	 * @param {String} migrationName - Name of the migration to be unlogged.
	 * @returns {Promise}
	 */
	unlogMigration (migrationName) {
		const filePath = this.path;
		const readfile = Bluebird.promisify(fs.readFile);
		const writefile = Bluebird.promisify(fs.writeFile);

		return readfile(filePath)
			.catch(() => '[]')
			.then((content) => JSON.parse(content))
			.then((content) => {
				content = content.filter(m => m !== migrationName);
				return writefile(filePath, JSON.stringify(content, null, '  '));
			});
	}

	/**
	 * Gets list of executed migrations.
	 *
	 * @returns {Promise.<String[]>}
	 */
	executed () {
		const filePath = this.path;
		const readfile = Bluebird.promisify(fs.readFile);

		return readfile(filePath)
			.catch(() => '[]')
			.then((content) => JSON.parse(content));
	}
}
