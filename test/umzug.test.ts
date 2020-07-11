import { Umzug2, getMigrations, MigrationType } from '../src/umzug';
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
	test('new Umzug2 requires script files', async () => {
		const spy = jest.spyOn(console, 'log').mockImplementation(() => {});

		const syncer = fsSyncer(join(__dirname, 'generated/new Umzug2/globjs'), {
			'm1.js': `exports.up = async params => console.log('up1', params)`,
		});
		syncer.sync();

		const umzug = new Umzug2({
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
	test('new Umzug2 with file globbing', async () => {
		const spy = jest.fn();

		const syncer = fsSyncer(join(__dirname, 'generated/new Umzug2/glob'), {
			'migration1.sql': 'select true',
			'migration2.sql': 'select true',
			'should-be-ignored.txt': 'abc',
			'migration3.sql': 'select true',
		});
		syncer.sync();

		const umzug = new Umzug2({
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

	test('new Umzug2 with migrations array', async () => {
		const spy = jest.fn();

		const syncer = fsSyncer(join(__dirname, 'generated/new Umzug2/migrationsArray'), {});
		syncer.sync();

		const umzug = new Umzug2({
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

	test('new Umzug2 with function returning migrations array', async () => {
		const spy = jest.fn();

		const syncer = fsSyncer(join(__dirname, 'generated/new Umzug2/functionMigrationsArray'), {});
		syncer.sync();

		const umzug = new Umzug2({
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

	test('new Umzug2 with custom file globbing options', async () => {
		const spy = jest.fn();

		const syncer = fsSyncer(join(__dirname, 'generated/new Umzug2/glob'), {
			'migration1.sql': 'select true',
			'migration2.sql': 'select true',
			'should-be-ignored.txt': 'abc',
			'migration3.sql': 'select true',
			'ignoreme1.sql': 'select false',
			'ignoreme2.sql': 'select false',
		});
		syncer.sync();

		const umzug = new Umzug2({
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

	test('new Umzug2 allows customization via getMigrations', async () => {
		const spy = jest.fn();

		const syncer = fsSyncer(join(__dirname, 'generated/new Umzug2/customOrdering'), {
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
		const umzug = new Umzug2({
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

	test('new Umzug2 supports nested directories via getMigrations', async () => {
		const spy = jest.fn();

		// folder structure splitting migrations into separate directories, with the filename determining the order:
		const syncer = fsSyncer(join(__dirname, 'generated/new Umzug2/customOrdering'), {
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

		const umzug = new Umzug2({
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
		expectTypeOf(Umzug2).constructorParameters.toMatchTypeOf<{ length: 1 }>();

		expectTypeOf(Umzug2).toBeConstructibleWith({ migrations: { glob: '*/*.js' }, storage: memoryStorage() });
		expectTypeOf(Umzug2).toBeConstructibleWith({
			migrations: { glob: ['*/*.js', { cwd: 'x/y/z' }] },
		});
		expectTypeOf(Umzug2).toBeConstructibleWith({
			migrations: { glob: ['*/*.js', { ignore: ['**/*ignoreme*.js'] }] },
		});
	});

	test('migration type', () => {
		// todo [>=3.0.0] un-lazify this. the migrations globbing should be lazy inside the class
		const umzug = () =>
			new Umzug2({
				migrations: { glob: '*/*.ts' },
				context: { someCustomSqlClient: {} },
			});

		type Migration = MigrationType<ReturnType<typeof umzug>>;

		expectTypeOf<Migration>()
			.parameter(0)
			.toEqualTypeOf<{ name: string; path: string; context: { someCustomSqlClient: {} } }>();

		expectTypeOf<Migration>().returns.resolves.toBeUnknown();
	});

	test('custom resolver type', () => {
		// eslint-disable-next-line no-new
		new Umzug2({
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
