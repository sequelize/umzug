import { getUmzug, getMigrations } from '../src/umzug';
import { memoryStorage } from '../src';
import { join } from 'path';
import { fsSyncer } from 'fs-syncer';
import { expectTypeOf } from 'expect-type';

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

describe('basic usage', () => {
	test('getUmzug requires script files', async () => {
		const spy = jest.spyOn(console, 'log').mockImplementation(() => {});

		const syncer = fsSyncer(join(__dirname, 'generated/getUmzug/globjs'), {
			'm1.js': `exports.up = async params => console.log('up1', params)`,
		});
		syncer.sync();

		const umzug = getUmzug({
			migrations: {
				glob: ['*.js', { cwd: syncer.baseDir }],
			},
			context: { someCustomSqlClient: {} },
		});

		await umzug.up();

		const names = (migrations: Array<{ file: string }>) => migrations.map(m => m.file);

		expect(names(await umzug.executed())).toEqual(['m1']);
		expect(spy).toHaveBeenCalledTimes(1);
		expect(spy).toHaveBeenNthCalledWith(1, 'up1', {
			context: { someCustomSqlClient: {} },
			name: 'm1',
			path: join(syncer.baseDir, 'm1.js'),
		});
	});
});

describe('alternate migration inputs', () => {
	test('getUmzug with file globbing', async () => {
		const spy = jest.fn();

		const syncer = fsSyncer(join(__dirname, 'generated/getUmzug/glob'), {
			'migration1.sql': 'select true',
			'migration2.sql': 'select true',
			'should-be-ignored.txt': 'abc',
			'migration3.sql': 'select true',
		});
		syncer.sync();

		const umzug = getUmzug({
			migrations: {
				glob: ['*.sql', { cwd: syncer.baseDir }],
				resolve: context => ({ up: spy.bind(null, context) }),
			},
			context: { someCustomSqlClient: {} },
		});

		await umzug.up();

		const names = (migrations: Array<{ file: string }>) => migrations.map(m => m.file);

		expect(names(await umzug.executed())).toEqual(['migration1', 'migration2', 'migration3']);
		expect(spy).toHaveBeenCalledTimes(3);
		expect(spy).toHaveBeenNthCalledWith(1, {
			context: { someCustomSqlClient: {} },
			name: 'migration1',
			path: join(syncer.baseDir, 'migration1.sql'),
		});
	});

	test('getUmzug with migrations array', async () => {
		const spy = jest.fn();

		const syncer = fsSyncer(join(__dirname, 'generated/getUmzug/migrationsArray'), {});
		syncer.sync();

		const umzug = getUmzug({
			migrations: [
				{ name: 'migration1', migration: { up: spy.bind(null, 'migration1-up') } },
				{ name: 'migration2', migration: { up: spy.bind(null, 'migration2-up') } },
			],
		});

		await umzug.up();

		const names = (migrations: Array<{ file: string }>) => migrations.map(m => m.file);

		expect(names(await umzug.executed())).toEqual(['migration1', 'migration2']);
		expect(spy).toHaveBeenCalledTimes(2);
		expect(spy).toHaveBeenNthCalledWith(1, 'migration1-up');
	});

	test('getUmzug with function returning migrations array', async () => {
		const spy = jest.fn();

		const syncer = fsSyncer(join(__dirname, 'generated/getUmzug/functionMigrationsArray'), {});
		syncer.sync();

		const umzug = getUmzug({
			migrations: context => {
				expect(context).toEqual({ someCustomSqlClient: {} });
				return [
					{ name: 'migration1', migration: { up: spy.bind(null, 'migration1-up') } },
					{ name: 'migration2', migration: { up: spy.bind(null, 'migration2-up') } },
				];
			},
			context: { someCustomSqlClient: {} },
		});

		await umzug.up();

		const names = (migrations: Array<{ file: string }>) => migrations.map(m => m.file);

		expect(names(await umzug.executed())).toEqual(['migration1', 'migration2']);
		expect(spy).toHaveBeenCalledTimes(2);
		expect(spy).toHaveBeenNthCalledWith(1, 'migration1-up');
	});

	test('getUmzug with custom file globbing options', async () => {
		const spy = jest.fn();

		const syncer = fsSyncer(join(__dirname, 'generated/getUmzug/glob'), {
			'migration1.sql': 'select true',
			'migration2.sql': 'select true',
			'should-be-ignored.txt': 'abc',
			'migration3.sql': 'select true',
			'ignoreme1.sql': 'select false',
			'ignoreme2.sql': 'select false',
		});
		syncer.sync();

		const umzug = getUmzug({
			migrations: {
				glob: ['*.sql', { cwd: syncer.baseDir, ignore: ['ignoreme*.sql'] }],
				resolve: params => ({ up: spy.bind(null, params) }),
			},
			context: { someCustomSqlClient: {} },
		});

		await umzug.up();

		const names = (migrations: Array<{ file: string }>) => migrations.map(m => m.file);

		expect(names(await umzug.executed())).toEqual(['migration1', 'migration2', 'migration3']);
		expect(spy).toHaveBeenCalledTimes(3);
		expect(spy).toHaveBeenNthCalledWith(1, {
			context: { someCustomSqlClient: {} },
			name: 'migration1',
			path: join(syncer.baseDir, 'migration1.sql'),
		});
	});

	test('getUmzug allows customization via getMigrations', async () => {
		const spy = jest.fn();

		const syncer = fsSyncer(join(__dirname, 'generated/getUmzug/customOrdering'), {
			'migration1.sql': 'select true',
			'migration2.sql': 'select true',
			'should-be-ignored.txt': 'abc',
			'migration3.sql': 'select true',
		});
		syncer.sync();

		const storage = memoryStorage();

		const migrationsWithStandardOrdering = getMigrations({
			glob: ['*.sql', { cwd: syncer.baseDir }],
			resolve: params => ({ up: spy.bind(null, params) }),
		});
		const umzug = getUmzug({
			// This example reverses migrations, but you could order them however you like
			migrations: migrationsWithStandardOrdering.slice().reverse(),
			storage,
		});

		await umzug.up();

		const names = (migrations: Array<{ file: string }>) => migrations.map(m => m.file);

		expect(names(await umzug.executed())).toEqual(['migration3', 'migration2', 'migration1']);
		expect(spy).toHaveBeenCalledTimes(3);
		expect(spy).toHaveBeenNthCalledWith(1, {
			name: 'migration3',
			path: join(syncer.baseDir, 'migration3.sql'),
		});
	});

	test('getUmzug supports nested directories via getMigrations', async () => {
		const spy = jest.fn();

		// folder structure splitting migrations into separate directories, with the filename determining the order:
		const syncer = fsSyncer(join(__dirname, 'generated/getUmzug/customOrdering'), {
			directory1: {
				'm1.sql': 'select true',
				'm1.down.sql': 'select false',
				'm4.sql': 'select true',
			},
			deeply: {
				nested: {
					directory2: {
						'm2.sql': 'select true',
						'm3.sql': 'select true',
					},
				},
			},
		});
		syncer.sync();

		const storage = memoryStorage();

		const migrationsWithStandardOrdering = getMigrations({
			glob: ['**/*.sql', { cwd: syncer.baseDir, ignore: '**/*.down.sql' }],
			resolve: params => ({ up: spy.bind(null, params) }),
		});

		const umzug = getUmzug({
			migrations: migrationsWithStandardOrdering.slice().sort((a, b) => a.name.localeCompare(b.name)),
			storage,
		});

		await umzug.up();

		const names = (migrations: Array<{ file: string }>) => migrations.map(m => m.file);

		expect(names(await umzug.executed())).toEqual(['m1', 'm2', 'm3', 'm4']);
		expect(spy).toHaveBeenCalledTimes(4);
		expect(spy).toHaveBeenNthCalledWith(1, {
			name: 'm1',
			path: join(syncer.baseDir, 'directory1/m1.sql'),
		});
		expect(spy).toHaveBeenNthCalledWith(2, {
			name: 'm2',
			path: join(syncer.baseDir, 'deeply/nested/directory2/m2.sql'),
		});
	});
});

describe('types', () => {
	test('constructor function', () => {
		expectTypeOf(getUmzug).parameters.toMatchTypeOf<{ length: 1 }>();

		expectTypeOf(getUmzug).toBeCallableWith({ migrations: { glob: '*/*.js' }, storage: memoryStorage() });
		expectTypeOf(getUmzug).toBeCallableWith({
			migrations: { glob: ['*/*.js', { cwd: 'x/y/z' }] },
		});
		expectTypeOf(getUmzug).toBeCallableWith({
			migrations: { glob: ['*/*.js', { ignore: ['**/*ignoreme*.js'] }] },
		});
	});

	test('migration type', () => {
		// use lazy getter to avoid actually hitting disk
		const get = () =>
			getUmzug({
				migrations: { glob: '*/*.ts' },
				context: { someCustomSqlClient: {} },
			});

		type Migration = ReturnType<typeof get>['_types']['migration'];

		expectTypeOf<Migration>()
			.parameter(0)
			.toEqualTypeOf<{ name: string; path: string; context: { someCustomSqlClient: {} } }>();

		expectTypeOf<Migration>().returns.resolves.toBeUnknown();
	});

	test('custom resolver type', () => {
		getUmzug({
			migrations: {
				glob: '*/*.ts',
				resolve: params => {
					expectTypeOf(params).toEqualTypeOf<{ name: string; path: string; context: { someCustomSqlClient: {} } }>();
					return { up: async () => {} };
				},
			},
			context: { someCustomSqlClient: {} },
		});
	});
});
