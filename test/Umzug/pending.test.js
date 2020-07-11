/* eslint-disable @typescript-eslint/promise-function-async */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/restrict-plus-operands */
const helper = require('../helper')('pending');
const { Migration } = require('../../src/migration');
const { Umzug, memoryStorage } = require('../../src');

const state = {};

const pendingTestSuite = function () {
	describe('when no migrations has been executed yet', () => {
		beforeEach(() => {
			return state.umzug.pending().then(migrations => {
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
				.then(() => state.umzug.pending())
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
	});

	describe('when storage returns a thenable', () => {
		beforeEach(() => {
			// a migration has been executed already
			return state.umzug
				.execute({
					migrations: [state.migrationNames[0]],
					method: 'up',
				})
				.then(() => {
					// storage returns a thenable
					state.umzug.storage = helper.wrapStorageAsCustomThenable(state.umzug.storage);

					return state.umzug.pending();
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
	});
};

describe('pending', () => {
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

	pendingTestSuite();
});

describe('pending-directories', () => {
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

	pendingTestSuite();
});
