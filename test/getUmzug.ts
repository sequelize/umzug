import test from 'ava';
import { getUmzug, resolveMigrations } from '../src/umzug';
import { JSONStorage } from '../src/storages/JSONStorage';
import { join } from 'path';
import { fsSyncer } from 'fs-syncer';
import * as sinon from 'sinon';
import { expectTypeOf } from 'expect-type';
import { UmzugStorage } from '../src/storages/type-helpers/umzug-storage';

test('getUmzug with migrations array', async t => {
	const spy = sinon.spy();

	const syncer = fsSyncer(join(__dirname, 'generated/getUmzug/migrationsArray'), {});
	syncer.sync();

	const umzug = getUmzug({
		migrations: [
			{ name: 'migration1', migration: { up: spy.bind(null, 'migration1-up') } },
			{ name: 'migration2', migration: { up: spy.bind(null, 'migration2-up') } },
		],
		storage: new JSONStorage({ path: join(syncer.baseDir, 'storage.json') }),
	});

	await umzug.up();

	const names = (migrations: Array<{ file: string }>) => migrations.map(m => m.file);

	t.deepEqual(names(await umzug.executed()), ['migration1', 'migration2']);
	t.true(spy.calledOnce);
	t.deepEqual(spy.firstCall.args, ['migration1-up']);
});

test('getUmzug with function returning migrations array', async t => {
	const spy = sinon.spy();

	const syncer = fsSyncer(join(__dirname, 'generated/getUmzug/functionMigrationsArray'), {});
	syncer.sync();

	const umzug = getUmzug({
		migrations: storage => {
			expectTypeOf(storage).not.toEqualTypeOf<UmzugStorage>();
			expectTypeOf(storage).toEqualTypeOf<JSONStorage>();
			return [
				{ name: 'migration1', migration: { up: spy.bind(null, 'migration1-up', storage) } },
				{ name: 'migration2', migration: { up: spy.bind(null, 'migration2-up', storage) } },
			];
		},
		storage: new JSONStorage({ path: join(syncer.baseDir, 'storage.json') }),
	});

	await umzug.up();

	const names = (migrations: Array<{ file: string }>) => migrations.map(m => m.file);

	t.deepEqual(names(await umzug.executed()), ['migration1', 'migration2']);
	t.true(spy.calledTwice);
	t.deepEqual(spy.firstCall.args, ['migration1-up', umzug.storage]);
});

test('getUmzug with glob', async t => {
	const spy = sinon.spy();

	const syncer = fsSyncer(join(__dirname, 'generated/getUmzug/glob'), {
		'migration1.sql': 'select true',
		'migration2.sql': 'select true',
		'should-be-ignored.txt': 'abc',
		'migration3.sql': 'select true',
	});
	syncer.sync();

	const storagePath = join(syncer.baseDir, 'storage.json');
	const umzug = getUmzug({
		migrations: {
			glob: ['*.sql', { cwd: syncer.baseDir }],
			resolve: params => ({
				up: spy.bind(null, params),
			}),
		},
		storage: new JSONStorage({ path: storagePath }),
	});

	await umzug.up();

	const names = (migrations: Array<{ file: string }>) => migrations.map(m => m.file);

	t.deepEqual(names(await umzug.executed()), ['migration1', 'migration2', 'migration3']);
	t.true(spy.calledThrice);
	t.deepEqual(spy.firstCall.args, [
		{
			storage: umzug.storage,
			name: 'migration1',
			path: 'migration1.sql',
		},
	]);
});

test('getUmzug allows customization via resolveMigrations', async t => {
	const spy = sinon.spy();

	const syncer = fsSyncer(join(__dirname, 'generated/getUmzug/customOrdering'), {
		'migration1.sql': 'select true',
		'migration2.sql': 'select true',
		'should-be-ignored.txt': 'abc',
		'migration3.sql': 'select true',
	});
	syncer.sync();

	const storage = new JSONStorage({ path: join(syncer.baseDir, 'storage.json') });

	const migrationsWithStandardOrdering = resolveMigrations(
		{
			glob: ['*.sql', { cwd: syncer.baseDir }],
			resolve: params => ({
				up: spy.bind(null, params),
			}),
		},
		storage
	);
	const umzug = getUmzug({
		// This example reverses migrations, but you could order them however you like
		migrations: migrationsWithStandardOrdering.slice().reverse(),
		storage,
	});

	await umzug.up();

	const names = (migrations: Array<{ file: string }>) => migrations.map(m => m.file);

	t.deepEqual(names(await umzug.executed()), ['migration3', 'migration2', 'migration1']);
	t.true(spy.calledThrice);
	t.deepEqual(spy.firstCall.args, [
		{
			storage: umzug.storage,
			name: 'migration3',
			path: 'migration3.sql',
		},
	]);
});
