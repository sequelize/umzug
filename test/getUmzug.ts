import test from 'ava';
import { getUmzug } from '../src/umzug';
import { JSONStorage } from '../src/storages/JSONStorage';
import { join } from 'path';
import { fsSyncer } from 'fs-syncer';
import * as sinon from 'sinon';

test('getUmzug with migrations array', async t => {
	const jsonPath = join(__dirname, 'getUmzug.json');
	const umzug = getUmzug({
		migrations: [
			{ name: 'migration1', migration: { up: async () => 1 } },
			{ name: 'migration2', migration: { up: async () => 1 } },
		],
		storage: new JSONStorage({ path: jsonPath }),
	});

	await umzug.up();

	const names = (migrations: Array<{ file: string }>) => migrations.map(m => m.file);

	t.deepEqual(names(await umzug.executed()), ['migration1', 'migration2']);
});

// eslint-disable-next-line ava/no-only-test
test.only('getUmzug with glob', async t => {
	const spy = sinon.spy((..._args: unknown[]): unknown => 1);
	const syncer = fsSyncer(join(__dirname, 'generated/getUmzug/glob'), {
		'migration1.sql': 'select true',
		'migration2.sql': 'select true',
		'should-be-ignored.txt': 'abc',
		'migration3.sql': 'select true',
	});
	syncer.sync();
	console.log(syncer.baseDir, syncer.read());
	const jsonPath = join(__dirname, 'getUmzug.json');
	const umzug = getUmzug({
		migrations: {
			glob: ['generated/getUmzug/glob/*.sql', { cwd: __dirname }],
			resolve: params => ({
				up: async () => spy(['up', params]) as unknown,
				down: async () => spy(['down', params]) as unknown,
			}),
		},
		storage: new JSONStorage({ path: jsonPath }),
	});

	await umzug.up();

	const names = (migrations: Array<{ file: string }>) => migrations.map(m => m.file);

	t.deepEqual(names(await umzug.executed()), ['migration1', 'migration2', 'migration3']);
	t.deepEqual(spy.getCalls(), []);
});
