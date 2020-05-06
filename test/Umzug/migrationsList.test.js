/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable unicorn/filename-case */
const { Umzug, memoryStorage } = require('../../src');
const { migrationsList } = require('../../src/migrationsList');
const helper = require('../helper')('migrationsList');

describe('migrationsList', () => {
	beforeEach(() => {
		helper.clearTmp();
	});

	it('test migrationsList', async () => {
		let upped = false;
		let downed = false;
		const migrations = migrationsList(
			[
				{
					name: '00',
					up: async param => {
						expect(param).toBe('hello');
						upped = true;
					},
					down: async param => {
						expect(param).toBe('hello');
						downed = true;
					},
				},
			],
			['hello']
		);
		const umzug = new Umzug({
			migrations,
			storage: memoryStorage(),
		});

		expect((await umzug.pending())[0].file).toBe('00');
		expect(upped).toBe(false);
		expect(downed).toBe(false);
		await umzug.up();
		expect(upped).toBe(true);
		expect(downed).toBe(false);
		expect((await umzug.executed())[0].file).toBe('00');
		await umzug.down();
		expect(downed).toBe(true);
		expect((await umzug.pending())[0].file).toBe('00');
	});
});
