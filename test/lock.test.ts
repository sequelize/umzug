import { LockableJSONStorage, Umzug } from '../src';
import * as path from 'path';
import { fsSyncer } from 'fs-syncer';

const names = (migrations: Array<{ name: string }>) => migrations.map(m => m.name);

describe('locks', () => {
	const syncer = fsSyncer(path.join(__dirname, 'generated/lock/json'), {});
	syncer.sync();

	test('json', async () => {
		const umzug = new Umzug({
			migrations: [1, 2].map(n => ({
				name: `m${n}`,
				up: async () =>
					new Promise(r => {
						setTimeout(r, 100);
					}),
			})),
			storage: new LockableJSONStorage({ path: path.join(syncer.baseDir, `storage.json`) }),
			logger: undefined,
		});

		const promise1 = umzug.up();
		const promise2 = umzug.up();

		expect(syncer.read()).toEqual({});

		await expect(promise2).rejects.toThrowError(
			/Can't acquire lock (.*). .*storage.json.lock exists, transaction id: .*/
		);
		await expect(promise1.then(names)).resolves.toEqual(['m1', 'm2']);

		expect(names(await umzug.executed())).toEqual(['m1', 'm2']);
		expect(syncer.read()).toEqual({
			'storage.json': JSON.stringify(['m1', 'm2'], null, 2),
		});
	});
});
