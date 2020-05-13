/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/promise-function-async */
/* eslint-disable @typescript-eslint/no-unsafe-return */
const helper = require('../helper')('execute');
const { Umzug, memoryStorage } = require('../../src');
const sinon = require('sinon');
const { join } = require('path');

const resolveStub = Promise.resolve.bind(Promise);

const state = {};

describe('execute', () => {
	beforeEach(() => {
		helper.clearTmp();
		return helper.prepareMigrations(1, { names: ['123-migration'] }).then(() => {
			state.migration = require(helper.tmpDir + '/123-migration.js');

			state.upStub = sinon.stub(state.migration, 'up').callsFake(resolveStub);
			state.downStub = sinon.stub(state.migration, 'down').callsFake(resolveStub);

			state.logSpy = sinon.spy();
			state.umzug = new Umzug({
				migrations: { path: helper.tmpDir },
				storage: memoryStorage(),
				logging: state.logSpy,
			});
			state.migrate = method =>
				state.umzug.execute({
					migrations: ['123-migration'],
					method: method,
				});
			['migrating', 'migrated', 'reverting', 'reverted'].forEach(event => {
				// eslint-disable-next-line no-multi-assign
				const spy = (state[event + 'EventSpy'] = sinon.spy());
				state.umzug.on(event, spy);
			}, state);
		});
	});

	afterEach(() => {
		state.migration.up.restore();
		state.migration.down.restore();
	});

	it('requires migration methods to return a promise', () => {
		helper.clearTmp();
		return helper
			.prepareMigrations(1, { names: ['123-migration'], returnUndefined: true })
			.then(() => {
				state.migration = require(helper.tmpDir + '/123-migration.js');
				if (state.migration.up.restore) {
					state.migration.up.restore();
				}

				if (state.migration.down.restore) {
					state.migration.down.restore();
				}

				state.upStub = sinon.stub(state.migration, 'up').callsFake(() => ({}));
				state.downStub = sinon.stub(state.migration, 'down').callsFake(resolveStub);
				state.logSpy = sinon.spy();
				state.umzug = new Umzug({
					migrations: { path: helper.tmpDir },
					storage: memoryStorage(),
					logging: state.logSpy,
				});
				return state.umzug.execute({
					migrations: ['123-migration'],
					method: 'up',
				});
			})
			.then(() => {
				throw new Error('expected migration to fail');
			})
			.catch(error => {
				expect(error.message).toMatch(/migration 123-migration.js \(or wrapper\) didn't return a promise/i);
			});
	});

	it('runs the up method of the migration', () => {
		return state.migrate('up').then(() => {
			expect(state.upStub.callCount).toBe(1);
			expect(state.downStub.callCount).toBe(0);
			expect(state.logSpy.callCount).toBe(2);
			expect(state.logSpy.getCall(0).args[0]).toBe('== 123-migration: migrating =======');
			expect(state.logSpy.getCall(1).args[0]).toMatch(/== 123-migration: migrated \(0\.0\d\ds\)/);
			expect(state.migratingEventSpy.calledWith('123-migration')).toBe(true);
			expect(state.migratedEventSpy.calledWith('123-migration')).toBe(true);
		});
	});

	it('runs the down method of the migration', () => {
		return state.migrate('down').then(() => {
			expect(state.upStub.callCount).toBe(0);
			expect(state.downStub.callCount).toBe(1);
			expect(state.logSpy.callCount).toBe(2);
			expect(state.logSpy.getCall(0).args[0]).toBe('== 123-migration: reverting =======');
			expect(state.logSpy.getCall(1).args[0]).toMatch(/== 123-migration: reverted \(0\.0\d\ds\)/);
			expect(state.revertingEventSpy.calledWith('123-migration')).toBe(true);
			expect(state.revertedEventSpy.calledWith('123-migration')).toBe(true);
		});
	});

	it('does not execute a migration twice', () => {
		return state
			.migrate('up')
			.then(() => state.migrate('up'))
			.then(() => {
				expect(state.upStub.callCount).toBe(1);
				expect(state.downStub.callCount).toBe(0);
			});
	});

	it('does not add an executed entry to the storage.json', () => {
		return state
			.migrate('up')
			.then(() => state.migrate('up'))
			.then(async () => {
				const files = list => list.map(m => m.file);
				expect(files(await state.umzug.executed())).toEqual(['123-migration.js']);
			});
	});

	it('calls the migration without params by default', () => {
		return state.migrate('up').then(() => {
			expect(state.upStub.getCall(0).args).toEqual([]);
		});
	});

	it('calls the migration with the specified params', () => {
		state.umzug.options.migrations.params = [1, 2, 3];

		return state.migrate('up').then(() => {
			expect(state.upStub.getCall(0).args).toEqual([1, 2, 3]);
		});
	});

	it('calls the migration with the result of the passed function', () => {
		state.umzug.options.migrations.params = () => [1, 2, 3];

		return state.migrate('up').then(() => {
			expect(state.upStub.getCall(0).args).toEqual([1, 2, 3]);
		});
	});

	describe('when the migration does not contain a migration method', () => {
		beforeEach(() => {
			state.oldup = state.migration.up;
			delete state.migration.up;
		});

		it('rejects the promise', () => {
			return state.migrate('up').then(
				() => Promise.reject(new Error('We should not end up here...')),
				err => {
					expect(err).toBeInstanceOf(Error);
					expect(err.message).toBe('Could not find migration method: up');
				}
			);
		});

		afterEach(() => {
			state.migration.up = state.oldup;
			delete state.oldup;
		});
	});
});

describe('migrations.wrap', () => {
	beforeEach(() => {
		helper.clearTmp();
		require('fs').writeFileSync(
			join(helper.tmpDir, '/123-callback-last-migration.js'),
			[
				"'use strict';",
				'',
				'module.exports = {',
				'  up: function (done) {',
				'    setTimeout(done, 200);',
				'  },',
				'  down: function () {}',
				'};',
			].join('\n')
		);
	});

	it('can be used to handle "callback last" migrations', () => {
		const start = Number(new Date());
		const umzug = new Umzug({
			migrations: {
				path: helper.tmpDir,
				wrap: fun => {
					if (fun.length === 1) {
						return helper.promisify(fun);
					}

					return fun;
				},
			},
			storage: memoryStorage(),
		});

		return umzug
			.execute({
				migrations: ['123-callback-last-migration'],
				method: 'up',
			})
			.then(() => {
				expect(Number(new Date()) - start).toBeGreaterThan(200);
			});
	});
});
