/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/restrict-plus-operands */
/* eslint-disable @typescript-eslint/promise-function-async */
const _ = require('lodash');
const jetpack = require('fs-jetpack').cwd(__dirname);
const { ToryFolder } = require('tory');
const path = require('path');

const getHelper = subdir => {
	const tmpDir = `generated/legacy-tests/${subdir}`;
	const helper = {
		tmpDir: path.join(__dirname, tmpDir),
		clearTmp() {
			jetpack.dir(tmpDir);
			const tmpFolder = new ToryFolder(jetpack.path(tmpDir));
			for (const file of tmpFolder.toDFSFilesRecursiveIterable()) {
				try {
					jetpack.remove(file.absolutePath);
				} catch {}
			}
		},

		generateDummyMigration(name, subDirectories, options = {}) {
			let filepath = jetpack.path(tmpDir);
			if (subDirectories) {
				if (!_.isArray(subDirectories)) {
					subDirectories = [subDirectories];
				}

				subDirectories.forEach(directory => {
					filepath = jetpack.path(filepath, directory);
					jetpack.dir(filepath);
				});
			}

			jetpack.write(
				jetpack.path(filepath, name + '.js'),
				[
					"'use strict';",
					'',
					'module.exports = {',
					`  up: function () { return ${options.returnUndefined ? 'undefined' : 'Promise.resolve()'}; },`,
					`  down: function () { return ${options.returnUndefined ? 'undefined' : 'Promise.resolve()'}; }`,
					'};',
				].join('\n')
			);

			return name;
		},

		prepareMigrations(count, options) {
			options = {
				names: [],
				directories: [], // can be array of strings or array of array of strings
				// example 1: ['foo','bar'] ==> generates /foo and /bar
				// example 2: [['foo','bar'],['foo','bar2']] ==> generates /foo/bar and /foo/bar2
				// example 3: ['foo',['foo','bar2']] ==> generates /foo and /foo/bar2
				...(options || {}),
			};
			const { returnUndefined } = options;

			return new Promise(resolve => {
				const names = options.names;
				let num = 0;

				helper.clearTmp();

				_.times(count, i => {
					num++;
					names.push(options.names[i] || num + '-migration');
					helper.generateDummyMigration(names[i], options.directories[i], { returnUndefined });
				});

				resolve(names);
			});
		},

		wrapStorageAsCustomThenable(storage) {
			return {
				logMigration(migration) {
					return helper._convertPromiseToThenable(storage.logMigration(migration));
				},
				unlogMigration(migration) {
					return helper._convertPromiseToThenable(storage.unlogMigration(migration));
				},
				executed() {
					return helper._convertPromiseToThenable(storage.executed());
				},
			};
		},

		_convertPromiseToThenable(promise) {
			return {
				then(onFulfilled, onRejected) {
					// note don't return anything!
					promise.then(onFulfilled, onRejected);
				},
			};
		},

		promisify(fn) {
			return (...args) =>
				new Promise((resolve, reject) => {
					fn(...args, (err, data) => {
						if (err) {
							reject(err);
						} else {
							resolve(data);
						}
					});
				});
		},
	};
	return helper;
};

module.exports = getHelper;
