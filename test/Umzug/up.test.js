/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/promise-function-async */
/* eslint-disable @typescript-eslint/restrict-plus-operands */
const helper = require('../helper')('up');
const { Migration } = require('../../src/migration');
const { Umzug, memoryStorage } = require('../../src');

const state = {};

const upTestSuite = function () {
	describe('when no migrations has been executed yet', () => {
		beforeEach(() => {
			return state.umzug.up().then(migrations => {
				state.migrations = migrations;
			});
		});

		it('returns an array', () => {
			expect(Array.isArray(state.migrations)).toBe(true);
		});

		it('returns 3 items', () => {
			expect(state.migrations).toHaveLength(3);
		});

		it('returns migration instances', () => {
			state.migrations.forEach(migration => {
				expect(migration).toBeInstanceOf(Migration);
			});
		});
	});

	describe('when a migration has been executed already', () => {
		beforeEach(() => {
			return state.umzug
				.execute({
					migrations: [state.migrationNames[0]],
					method: 'up',
				})
				.then(() => state.umzug.up())
				.then(migrations => {
					state.migrations = migrations;
				});
		});

		it('returns only 2 items', () => {
			expect(state.migrations).toHaveLength(2);
		});

		it('returns only the migrations that have not been run yet', () => {
			const self = state;

			state.migrationNames.slice(1).forEach((migrationName, i) => {
				expect(self.migrations[i].file).toBe(migrationName + '.js');
			});
		});

		it('adds the two missing migrations to the storage', () => {
			return state.umzug.executed().then(migrations => {
				expect(migrations).toHaveLength(3);
			});
		});
	});

	describe('when passing the `from` option', () => {
		describe('UP method', () => {
			beforeEach(() => {
				return state.umzug
					.up({
						from: state.migrationNames[1],
					})
					.then(migrations => {
						state.migrations = migrations;
					});
			});
			it('should return 1 migration', () => {
				expect(state.migrations).toHaveLength(1);
			});
			it('should be the last migration', () => {
				expect(state.migrations[0].file).toBe('3-migration.js');
			});
		});
	});

	describe('when passing the `to` option', () => {
		beforeEach(() => {
			return state.umzug
				.up({
					to: state.migrationNames[1],
				})
				.then(migrations => {
					state.migrations = migrations;
				});
		});

		it('returns only 2 migrations', () => {
			expect(state.migrations).toHaveLength(2);
		});

		it('executed only the first 2 migrations', () => {
			return state.umzug.executed().then(migrations => {
				expect(migrations).toHaveLength(2);
			});
		});

		it('did not execute the third migration', () => {
			return state.umzug.executed().then(migrations => {
				const migrationFiles = migrations.map(migration => migration.file);
				expect(migrationFiles).toEqual(expect.not.arrayContaining([state.migrationNames[2]]));
			});
		});

		describe('that does not match a migration', () => {
			it('rejects the promise', () => {
				return state.umzug.up({ to: '123-asdasd' }).then(
					() => Promise.reject(new Error('We should not end up here...')),
					err => {
						expect(err.message).toBe('Unable to find migration: 123-asdasd');
					}
				);
			});
		});

		describe('that does not match a pending migration', () => {
			it('rejects the promise', () => {
				return state.umzug
					.execute({ migrations: state.migrationNames, method: 'up' })
					.then(() => state.umzug.up({ to: state.migrationNames[1] }))
					.then(
						() => Promise.reject(new Error('We should not end up here...')),
						err => {
							expect(err.message).toBe('Migration is not pending: 2-migration.js');
						}
					);
			});
		});
	});

	describe('when called with a string', () => {
		describe('that matches a pending migration', () => {
			beforeEach(() => {
				return state.umzug.up(state.migrationNames[1]).then(migrations => {
					state.migrations = migrations;
				});
			});

			it('returns only 1 migrations', () => {
				expect(state.migrations).toHaveLength(1);
			});

			it('executed only the second migrations', () => {
				return state.umzug.executed().then(migrations => {
					expect(migrations).toHaveLength(1);
					expect(migrations[0].testFileName(state.migrationNames[1])).toBeTruthy();
				});
			});
		});

		describe('that does not match a migration', () => {
			it('rejects the promise', () => {
				return state.umzug.up('123-asdasd').then(
					() => Promise.reject(new Error('We should not end up here...')),
					err => {
						expect(err.message).toBe('Unable to find migration: 123-asdasd');
					}
				);
			});
		});

		describe('that does not match a pending migration', () => {
			it('rejects the promise', () => {
				return state.umzug
					.execute({ migrations: state.migrationNames, method: 'up' })
					.then(() => state.umzug.up(state.migrationNames[1]))
					.then(
						() => Promise.reject(new Error('We should not end up here...')),
						err => {
							expect(err.message).toBe('Migration is not pending: 2-migration.js');
						}
					);
			});
		});
	});

	describe('when called with an array', () => {
		describe('that matches a pending migration', () => {
			beforeEach(() => {
				return state.umzug.up([state.migrationNames[1]]).then(migrations => {
					state.migrations = migrations;
				});
			});

			it('returns only 1 migrations', () => {
				expect(state.migrations).toHaveLength(1);
			});

			it('executed only the second migrations', () => {
				return state.umzug.executed().then(migrations => {
					expect(migrations).toHaveLength(1);
					expect(migrations[0].testFileName(state.migrationNames[1])).toBeTruthy();
				});
			});
		});

		describe('that matches multiple pending migration', () => {
			beforeEach(() => {
				return state.umzug.up(state.migrationNames.slice(1)).then(migrations => {
					state.migrations = migrations;
				});
			});

			it('returns only 2 migrations', () => {
				expect(state.migrations).toHaveLength(2);
			});

			it('executed only the second and the third migrations', () => {
				return state.umzug.executed().then(migrations => {
					expect(migrations).toHaveLength(2);
					expect(migrations[0].testFileName(state.migrationNames[1])).toBeTruthy();
					expect(migrations[1].testFileName(state.migrationNames[2])).toBeTruthy();
				});
			});
		});

		describe('that does not match a migration', () => {
			it('rejects the promise', () => {
				return state.umzug.up(['123-asdasd']).then(
					() => Promise.reject(new Error('We should not end up here...')),
					err => {
						expect(err.message).toBe('Unable to find migration: 123-asdasd');
					}
				);
			});
		});

		describe('that does not match a pending migration', () => {
			it('rejects the promise', () => {
				return state.umzug
					.execute({ migrations: state.migrationNames, method: 'up' })
					.then(() => state.umzug.up([state.migrationNames[1]]))
					.then(
						() => Promise.reject(new Error('We should not end up here...')),
						err => {
							expect(err.message).toBe('Migration is not pending: 2-migration.js');
						}
					);
			});
		});

		describe('that does partially not match a pending migration', () => {
			it('rejects the promise', () => {
				return state.umzug
					.execute({ migrations: state.migrationNames.slice(0, 2), method: 'up' })
					.then(() => state.umzug.up(state.migrationNames.slice(1)))
					.then(
						() => Promise.reject(new Error('We should not end up here...')),
						err => {
							expect(err.message).toBe('Migration is not pending: 2-migration.js');
						}
					);
			});
		});
	});

	describe('when storage returns a thenable', () => {
		beforeEach(() => {
			// one migration has been executed already
			return state.umzug
				.execute({
					migrations: [state.migrationNames[0]],
					method: 'up',
				})
				.then(() => {
					// storage returns a thenable
					state.umzug.storage = helper.wrapStorageAsCustomThenable(state.umzug.storage);

					return state.umzug.up();
				})
				.then(migrations => {
					state.migrations = migrations;
				});
		});

		it('returns only 2 items', () => {
			expect(state.migrations).toHaveLength(2);
		});

		it('returns only the migrations that have not been run yet', () => {
			const self = state;

			state.migrationNames.slice(1).forEach((migrationName, i) => {
				expect(self.migrations[i].file).toBe(migrationName + '.js');
			});
		});

		it('adds the two missing migrations to the storage', () => {
			return state.umzug.executed().then(migrations => {
				expect(migrations).toHaveLength(3);
			});
		});
	});
};

describe('up', () => {
	beforeEach(() => {
		helper.clearTmp();
		return helper.prepareMigrations(3).then(migrationNames => {
			state.migrationNames = migrationNames;
			state.umzug = new Umzug({
				migrations: { path: helper.tmpDir },
				storage: memoryStorage(),
			});
		});
	});

	upTestSuite();
});

describe('up-directories', () => {
	beforeEach(() => {
		helper.clearTmp();
		return helper
			.prepareMigrations(3, {
				directories: [
					['1', '2'],
					['1', '2'],
					['1', '3', '4', '5'],
				],
			})
			.then(migrationNames => {
				state.migrationNames = migrationNames;
				state.umzug = new Umzug({
					migrations: { path: helper.tmpDir, traverseDirectories: true },
					storage: memoryStorage(),
				});
			});
	});

	upTestSuite();
});
