import { JSONStorage, addLocker, FileLocker, Umzug } from '../src';
import * as path from 'path';
import { fsSyncer } from 'fs-syncer';
import * as pEvent from 'p-event';

const names = (migrations: Array<{ name: string }>) => migrations.map(m => m.name);
// eslint-disable-next-line no-promise-executor-return
const delay = async (ms: number) => new Promise(r => setTimeout(r, ms));

describe('locks', () => {
	const syncer = fsSyncer(path.join(__dirname, 'generated/lock/json'), {});
	syncer.sync();

	test('json', async () => {
		const umzug = new Umzug({
			migrations: [1, 2].map(n => ({
				name: `m${n}`,
				up: async () => delay(100),
			})),
			storage: addLocker(
				new JSONStorage({ path: path.join(syncer.baseDir, 'storage.json') }),
				new FileLocker(path.join(syncer.baseDir, 'storage.json.lock'))
			),
			logger: undefined,
		});
		expect(syncer.read()).toEqual({});

		const promise1 = umzug.up();
		await pEvent(umzug, 'migrating');
		const promise2 = umzug.up();

		await expect(promise2).rejects.toThrowError(/Can't acquire lock (.*). .*storage.json.lock exists with id: .*/);
		await expect(promise1.then(names)).resolves.toEqual(['m1', 'm2']);

		expect(names(await umzug.executed())).toEqual(['m1', 'm2']);
		expect(syncer.read()).toEqual({
			'storage.json': JSON.stringify(['m1', 'm2'], null, 2),
		});
	});
});
