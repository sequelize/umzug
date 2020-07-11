/* eslint-disable @typescript-eslint/promise-function-async */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/restrict-plus-operands */
const helper = require('../helper')('executed');
const { UmzugLegacy: Umzug, memoryStorage } = require('../../src');

const state = {};

const executedTestSuite = function () {
	describe('when no migrations has been executed yet', () => {
		beforeEach(() => {
			return state.umzug.executed().then(migrations => {
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

	describe('when one migration has been executed yet', () => {
		beforeEach(() => {
			return state.umzug
				.execute({
					migrations: [state.migrationNames[0]],
					method: 'up',
				})
				.then(() => state.umzug.executed())
				.then(migrations => {
					state.migrations = migrations;
				});
		});

		it('returns an array', () => {
			expect(Array.isArray(state.migrations)).toBe(true);
		});

		it('returns 1 items', () => {
			expect(state.migrations).toHaveLength(1);
			expect(state.migrations[0].file).toBe(state.migrationNames[0] + '.js');
		});
	});

	describe('when all migration has been executed yet', () => {
		beforeEach(() => {
			return state.umzug
				.execute({
					migrations: state.migrationNames,
					method: 'up',
				})
				.then(() => state.umzug.executed())
				.then(migrations => {
					state.migrations = migrations;
				});
		});

		it('returns an array', () => {
			expect(Array.isArray(state.migrations)).toBe(true);
		});

		it('returns 3 items', () => {
			expect(state.migrations).toHaveLength(3);
			expect(state.migrations[0].file).toBe(state.migrationNames[0] + '.js');
			expect(state.migrations[1].file).toBe(state.migrationNames[1] + '.js');
			expect(state.migrations[2].file).toBe(state.migrationNames[2] + '.js');
		});
	});

	describe('when storage returns a thenable', () => {
		beforeEach(() => {
			// migration has been executed already
			return state.umzug
				.execute({
					migrations: [state.migrationNames[0]],
					method: 'up',
				})
				.then(() => {
					state.umzug.storage = helper.wrapStorageAsCustomThenable(state.umzug.storage);
					return state.umzug.executed();
				})
				.then(migrations => {
					state.migrations = migrations;
				});
		});

		it('returns an array', () => {
			expect(Array.isArray(state.migrations)).toBe(true);
		});

		it('returns 1 items', () => {
			expect(state.migrations).toHaveLength(1);
			expect(state.migrations[0].file).toBe(state.migrationNames[0] + '.js');
		});
	});
};

describe('executed', () => {
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

	executedTestSuite();
});

describe('executed-directories', () => {
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

	executedTestSuite();
});
