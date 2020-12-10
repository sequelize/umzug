import { memoryStorage, StorableMigration, Umzug, UmzugStorage } from '../src';

jest.mock('../src/storage', () => {
	const storage = jest.requireActual('../src/storage');
	// to simplify test setup, override JSONStorage with memoryStorage to use the default storage but avoid hitting the disk
	return {
		...storage,
		JSONStorage: function () {
			Object.assign(this, memoryStorage());
		},
	};
});

const names = (migrations: Array<{ name: string }>) => migrations.map(m => m.name);

describe('batching', () => {
	test('rollback', async () => {
		const noop = async () => {};
		const umzug = new Umzug({
			migrations: [
				{ name: 'm1', up: noop },
				{ name: 'm2', up: noop },
				{ name: 'm3', up: noop },
				{ name: 'm4', up: noop },
				{ name: 'm5', up: noop },
			],
			logger: undefined,
		});

		await umzug.up({ to: 'm3' });
		expect(names(await umzug.executed())).toEqual(['m1', 'm2', 'm3']);

		await umzug.up();
		expect(names(await umzug.executed())).toEqual(['m1', 'm2', 'm3', 'm4', 'm5']);

		await umzug.rollback();
		expect(names(await umzug.executed())).toEqual(['m1', 'm2', 'm3']);

		await umzug.up();
		expect(names(await umzug.executed())).toEqual(['m1', 'm2', 'm3', 'm4', 'm5']);

		const batches = (await umzug.executed()).map(e => e.batch).filter(Boolean);
		expect(batches).not.toHaveLength(0);

		await umzug.down({ batch: batches[0]! });
		expect(names(await umzug.executed())).toEqual(['m4', 'm5']);
	});

	test(`rollback fails when storage doesn't track batches`, async () => {
		const noop = async () => {};
		const umzug = new Umzug({
			migrations: [
				{ name: 'm1', up: noop },
				{ name: 'm2', up: noop },
				{ name: 'm3', up: noop },
			],
			storage: ((): UmzugStorage => {
				let executed: StorableMigration[] = [];
				return {
					logMigration: async name => {
						executed.push({ name, batch: undefined });
					},
					unlogMigration: async name => {
						executed = executed.filter(n => n.name !== name);
					},
					executed: async () => executed.slice(),
				};
			})(),
			logger: undefined,
		});

		await umzug.up();
		expect(names(await umzug.executed())).toEqual(['m1', 'm2', 'm3']);

		await expect(umzug.rollback()).rejects.toThrowErrorMatchingInlineSnapshot(
			`"Can't rollback; didn't find a batch for most recent migration m3. Use \`down\` instead."`
		);

		expect(names(await umzug.executed())).toEqual(['m1', 'm2', 'm3']);

		await umzug.down();
		expect(names(await umzug.executed())).toEqual(['m1', 'm2']);
	});
});
