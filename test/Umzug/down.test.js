/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable jest/no-standalone-expect */
/* eslint-disable @typescript-eslint/promise-function-async */
/* eslint-disable @typescript-eslint/restrict-plus-operands */
/* eslint-disable max-nested-callbacks */
const helper = require('../helper')('down');
const { Umzug, memoryStorage } = require('../../src');

const state = {};

const downTestSuite = function () {
	describe('when no migrations has been executed yet', () => {
		beforeEach(() => {
			return state.umzug.down().then(migrations => {
				state.migrations = migrations;
			});
		});

		it('returns an array', () => {
			expect(Array.isArray(state.migrations)).toBe(true);
		});

		it('returns 0 items', () => {
			expect(state.migrations).toHaveLength(0);
		});
	});

	describe('when a migration has been executed already', () => {
		beforeEach(() => {
			return state.umzug
				.execute({
					migrations: [state.migrationNames[0]],
					method: 'up',
				})
				.then(() => state.umzug.executed())
				.then(migrations => {
					expect(migrations).toHaveLength(1);
				})
				.then(() => state.umzug.down())
				.then(migrations => {
					state.migrations = migrations;
				});
		});

		it('returns 1 item', () => {
			expect(state.migrations).toHaveLength(1);
			expect(state.migrations[0].file).toBe(state.migrationNames[0] + '.js');
		});

		it('removes the reverted migrations from the storage', () => {
			return state.umzug.executed().then(migrations => {
				expect(migrations).toHaveLength(0);
			});
		});
	});

	describe('when all migrations have been executed already', () => {
		beforeEach(() => {
			return state.umzug
				.execute({
					migrations: state.migrationNames,
					method: 'up',
				})
				.then(() => state.umzug.executed())
				.then(migrations => {
					expect(migrations).toHaveLength(3);
				});
		});

		describe('when no option is specified', () => {
			beforeEach(() => {
				return state.umzug.down().then(migrations => {
					state.migrations = migrations;
				});
			});

			it('returns 1 item', () => {
				expect(state.migrations).toHaveLength(1);
				expect(state.migrations[0].file).toBe(state.migrationNames[2] + '.js');
			});

			it('removes the reverted migrations from the storage', () => {
				return state.umzug.executed().then(migrations => {
					expect(migrations).toHaveLength(2);
					expect(migrations[0].file).toBe(state.migrationNames[0] + '.js');
					expect(migrations[1].file).toBe(state.migrationNames[1] + '.js');
				});
			});
		});

		describe('when empty options is specified', () => {
			beforeEach(() => {
				return state.umzug.down({}).then(migrations => {
					state.migrations = migrations;
				});
			});

			it('returns 1 item', () => {
				expect(state.migrations).toHaveLength(1);
				expect(state.migrations[0].file).toBe(state.migrationNames[2] + '.js');
			});

			it('removes the reverted migrations from the storage', () => {
				return state.umzug.executed().then(migrations => {
					expect(migrations).toHaveLength(2);
					expect(migrations[0].file).toBe(state.migrationNames[0] + '.js');
					expect(migrations[1].file).toBe(state.migrationNames[1] + '.js');
				});
			});
		});

		describe('when `from` option is passed', () => {
			beforeEach(() => {
				return state.umzug
					.down({
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

		describe('when `to` option is passed', () => {
			beforeEach(() => {
				return state.umzug
					.down({
						to: state.migrationNames[1],
					})
					.then(migrations => {
						state.migrations = migrations;
					});
			});

			it('returns 2 item', () => {
				expect(state.migrations).toHaveLength(2);
				expect(state.migrations[0].file).toBe(state.migrationNames[2] + '.js');
				expect(state.migrations[1].file).toBe(state.migrationNames[1] + '.js');
			});

			it('removes the reverted migrations from the storage', () => {
				return state.umzug.executed().then(migrations => {
					expect(migrations).toHaveLength(1);
					expect(migrations[0].file).toBe(state.migrationNames[0] + '.js');
				});
			});

			describe('that does not match a migration', () => {
				it('rejects the promise', () => {
					return state.umzug.down({ to: '123-asdasd' }).then(
						() => Promise.reject(new Error('We should not end up here...')),
						err => {
							expect(err.message).toBe('Unable to find migration: 123-asdasd');
						}
					);
				});
			});

			describe('that does not match an executed migration', () => {
				it('rejects the promise', () => {
					return state.umzug
						.execute({ migrations: state.migrationNames, method: 'down' })
						.then(() => state.umzug.down({ to: state.migrationNames[1] }))
						.then(
							() => Promise.reject(new Error('We should not end up here...')),
							err => {
								expect(err.message).toBe('Migration was not executed: 2-migration.js');
							}
						);
				});
			});
		});
	});

	describe('when called with a string', () => {
		beforeEach(() => {
			return state.umzug.execute({
				migrations: state.migrationNames,
				method: 'up',
			});
		});

		describe('that matches an executed migration', () => {
			beforeEach(() => {
				return state.umzug.down(state.migrationNames[1]).then(migrations => {
					state.migrations = migrations;
				});
			});

			it('returns only 1 migrations', () => {
				expect(state.migrations).toHaveLength(1);
			});

			it('reverts only the second migrations', () => {
				return state.umzug.executed().then(migrations => {
					expect(migrations).toHaveLength(2);
					expect(migrations[0].testFileName(state.migrationNames[0])).toBeTruthy();
					expect(migrations[1].testFileName(state.migrationNames[2])).toBeTruthy();
				});
			});
		});

		describe('that does not match a migration', () => {
			it('rejects the promise', () => {
				return state.umzug.down('123-asdasd').then(
					() => Promise.reject(new Error('We should not end up here...')),
					err => {
						expect(err.message).toBe('Unable to find migration: 123-asdasd');
					}
				);
			});
		});

		describe('that does not match an executed migration', () => {
			it('rejects the promise', () => {
				return state.umzug
					.execute({ migrations: state.migrationNames, method: 'down' })
					.then(() => state.umzug.down(state.migrationNames[1]))
					.then(
						() => Promise.reject(new Error('We should not end up here...')),
						err => {
							expect(err.message).toBe('Migration was not executed: 2-migration.js');
						}
					);
			});
		});
	});

	describe('when called with an array', () => {
		beforeEach(() => {
			return state.umzug.execute({
				migrations: state.migrationNames,
				method: 'up',
			});
		});

		describe('that matches an executed migration', () => {
			beforeEach(() => {
				return state.umzug.down([state.migrationNames[1]]).then(migrations => {
					state.migrations = migrations;
				});
			});

			it('returns only 1 migrations', () => {
				expect(state.migrations).toHaveLength(1);
			});

			it('reverts only the second migrations', () => {
				return state.umzug.executed().then(migrations => {
					expect(migrations).toHaveLength(2);
					expect(migrations[0].testFileName(state.migrationNames[0])).toBeTruthy();
					expect(migrations[1].testFileName(state.migrationNames[2])).toBeTruthy();
				});
			});
		});

		describe('that matches multiple pending migration', () => {
			beforeEach(() => {
				return state.umzug.down(state.migrationNames.slice(1)).then(migrations => {
					state.migrations = migrations;
				});
			});

			it('returns only 2 migrations', () => {
				expect(state.migrations).toHaveLength(2);
			});

			it('reverts only the second and the third migrations', () => {
				return state.umzug.executed().then(migrations => {
					expect(migrations).toHaveLength(1);
					expect(migrations[0].testFileName(state.migrationNames[0])).toBeTruthy();
				});
			});
		});

		describe('that does not match a migration', () => {
			it('rejects the promise', () => {
				return state.umzug.down(['123-asdasd']).then(
					() => Promise.reject(new Error('We should not end up here...')),
					err => {
						expect(err.message).toBe('Unable to find migration: 123-asdasd');
					}
				);
			});
		});

		describe('that does not match an executed migration', () => {
			it('rejects the promise', () => {
				return state.umzug
					.execute({ migrations: state.migrationNames, method: 'down' })
					.then(() => state.umzug.down([state.migrationNames[1]]))
					.then(
						() => Promise.reject(new Error('We should not end up here...')),
						err => {
							expect(err.message).toBe('Migration was not executed: 2-migration.js');
						}
					);
			});
		});

		describe('that does partially not match an executed migration', () => {
			it('rejects the promise', () => {
				return state.umzug
					.execute({ migrations: state.migrationNames.slice(0, 2), method: 'down' })
					.then(() => state.umzug.down(state.migrationNames.slice(1)))
					.then(
						() => Promise.reject(new Error('We should not end up here...')),
						err => {
							expect(err.message).toBe('Migration was not executed: 2-migration.js');
						}
					);
			});
		});
	});

	describe('when storage returns a thenable', () => {
		beforeEach(() => {
			// a migration has been executed already...
			return state.umzug
				.execute({
					migrations: [state.migrationNames[0]],
					method: 'up',
				})
				.then(() => state.umzug.executed())
				.then(migrations => {
					expect(migrations).toHaveLength(1);
				})
				.then(() => {
					// storage returns a thenable
					state.umzug.storage = helper.wrapStorageAsCustomThenable(state.umzug.storage);

					return state.umzug.down();
				})
				.then(migrations => {
					state.migrations = migrations;
				});
		});

		it('returns 1 item', () => {
			expect(state.migrations).toHaveLength(1);
			expect(state.migrations[0].file).toBe(state.migrationNames[0] + '.js');
		});

		it('removes the reverted migrations from the storage', () => {
			return state.umzug.executed().then(migrations => {
				expect(migrations).toHaveLength(0);
			});
		});
	});
};

describe('down', () => {
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

	downTestSuite();
});

describe('down-directories', () => {
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

	downTestSuite();
});
