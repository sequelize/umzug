import { Umzug, MigrationFn } from '../src/umzug';
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

const names = (migrations: Array<{ name: string }>) => migrations.map(m => m.name);

describe('basic usage', () => {
	test('requires script files', async () => {
		const spy = jest.spyOn(console, 'log').mockImplementation(() => {});

		const syncer = fsSyncer(join(__dirname, 'generated/umzug/globjs'), {
			'm1.js': `exports.up = async params => console.log('up1', params)`,
		});
		syncer.sync();

		const umzug = new Umzug({
			migrations: {
				glob: ['*.js', { cwd: syncer.baseDir }],
			},
			context: { someCustomSqlClient: {} },
		});

		await umzug.up();

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
	test('with file globbing', async () => {
		const spy = jest.fn();

		const syncer = fsSyncer(join(__dirname, 'generated/umzug/glob'), {
			'migration1.sql': 'select true',
			'migration2.sql': 'select true',
			'should-be-ignored.txt': 'abc',
			'migration3.sql': 'select true',
		});
		syncer.sync();

		const umzug = new Umzug({
			migrations: {
				glob: ['*.sql', { cwd: syncer.baseDir }],
				resolve: context => ({ ...context, up: spy.bind(null, context) }),
			},
			context: { someCustomSqlClient: {} },
		});

		await umzug.up();

		expect(names(await umzug.executed())).toEqual(['migration1', 'migration2', 'migration3']);
		expect(spy).toHaveBeenCalledTimes(3);
		expect(spy).toHaveBeenNthCalledWith(1, {
			context: { someCustomSqlClient: {} },
			name: 'migration1',
			path: join(syncer.baseDir, 'migration1.sql'),
		});
	});

	test('to', async () => {
		const noop = async () => {};
		const umzug = new Umzug({
			migrations: [
				{ name: 'm1', up: noop },
				{ name: 'm2', up: noop },
				{ name: 'm3', up: noop },
				{ name: 'm4', up: noop },
				{ name: 'm5', up: noop },
				{ name: 'm6', up: noop },
				{ name: 'm7', up: noop },
			],
		});

		await umzug.up();

		expect(names(await umzug.executed())).toEqual(['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7']);
		expect(names(await umzug.pending())).toEqual([]);

		await umzug.down({});
		expect(names(await umzug.executed())).toEqual(['m1', 'm2', 'm3', 'm4', 'm5', 'm6']);

		await umzug.down({ to: undefined });
		expect(names(await umzug.executed())).toEqual(['m1', 'm2', 'm3', 'm4', 'm5']);

		await umzug.down({ to: 'm3' });
		expect(names(await umzug.executed())).toEqual(['m1', 'm2']);

		await umzug.down({ to: 0 });
		expect(names(await umzug.executed())).toEqual([]);

		await umzug.up({ to: 'm4' });
		expect(names(await umzug.executed())).toEqual(['m1', 'm2', 'm3', 'm4']);
	});

	test('with migrations array', async () => {
		const spy = jest.fn();

		const syncer = fsSyncer(join(__dirname, 'generated/umzug/migrationsArray'), {});
		syncer.sync();

		const umzug = new Umzug({
			migrations: [
				{ name: 'migration1', up: spy.bind(null, 'migration1-up') },
				{ name: 'migration2', up: spy.bind(null, 'migration2-up') },
			],
		});

		await umzug.up();

		expect(names(await umzug.executed())).toEqual(['migration1', 'migration2']);
		expect(spy).toHaveBeenCalledTimes(2);
		expect(spy).toHaveBeenNthCalledWith(1, 'migration1-up');
	});

	test('with function returning migrations array', async () => {
		const spy = jest.fn();

		const syncer = fsSyncer(join(__dirname, 'generated/umzug/functionMigrationsArray'), {});
		syncer.sync();

		const umzug = new Umzug({
			migrations: context => {
				expect(context).toEqual({ someCustomSqlClient: {} });
				return [
					{ name: 'migration1', up: spy.bind(null, 'migration1-up') },
					{ name: 'migration2', up: spy.bind(null, 'migration2-up') },
				];
			},
			context: { someCustomSqlClient: {} },
		});

		await umzug.up();

		expect(names(await umzug.executed())).toEqual(['migration1', 'migration2']);
		expect(spy).toHaveBeenCalledTimes(2);
		expect(spy).toHaveBeenNthCalledWith(1, 'migration1-up');
	});

	test('with custom file globbing options', async () => {
		const spy = jest.fn();

		const syncer = fsSyncer(join(__dirname, 'generated/umzug/glob'), {
			'migration1.sql': 'select true',
			'migration2.sql': 'select true',
			'should-be-ignored.txt': 'abc',
			'migration3.sql': 'select true',
			'ignoreme1.sql': 'select false',
			'ignoreme2.sql': 'select false',
		});
		syncer.sync();

		const umzug = new Umzug({
			migrations: {
				glob: ['*.sql', { cwd: syncer.baseDir, ignore: ['ignoreme*.sql'] }],
				resolve: params => ({ ...params, up: spy.bind(null, params) }),
			},
			context: { someCustomSqlClient: {} },
		});

		await umzug.up();

		expect(names(await umzug.executed())).toEqual(['migration1', 'migration2', 'migration3']);
		expect(spy).toHaveBeenCalledTimes(3);
		expect(spy).toHaveBeenNthCalledWith(1, {
			context: { someCustomSqlClient: {} },
			name: 'migration1',
			path: join(syncer.baseDir, 'migration1.sql'),
		});
	});

	test('allows customization via getMigrations', async () => {
		const spy = jest.fn();

		const syncer = fsSyncer(join(__dirname, 'generated/umzug/customOrdering'), {
			'migration1.sql': 'select true',
			'migration2.sql': 'select true',
			'should-be-ignored.txt': 'abc',
			'migration3.sql': 'select true',
		});
		syncer.sync();

		const parent = new Umzug({
			migrations: {
				glob: ['*.sql', { cwd: syncer.baseDir }],
				resolve: ({ context, ...params }) => ({ ...params, up: context.spy.bind(null, params) }),
			},
			context: { spy },
		});

		const umzug = parent.extend(migrations => migrations.slice().reverse());

		await umzug.up();

		expect(names(await umzug.executed())).toEqual(['migration3', 'migration2', 'migration1']);
		expect(spy).toHaveBeenCalledTimes(3);
		expect(spy).toHaveBeenNthCalledWith(1, {
			name: 'migration3',
			path: join(syncer.baseDir, 'migration3.sql'),
		});
	});

	test('supports nested directories via getMigrations', async () => {
		const spy = jest.fn();

		// folder structure splitting migrations into separate directories, with the filename determining the order:
		const syncer = fsSyncer(join(__dirname, 'generated/umzug/customOrdering'), {
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

		const withDefaultOrdering = new Umzug({
			migrations: {
				glob: ['**/*.sql', { cwd: syncer.baseDir, ignore: '**/*.down.sql' }],
				resolve: params => ({ ...params, up: spy.bind(null, params) }),
			},
		});

		const umzug = withDefaultOrdering.extend(standard => {
			return standard.slice().sort((a, b) => a.name.localeCompare(b.name));
		});

		await umzug.up();

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
		expectTypeOf(Umzug).constructorParameters.toMatchTypeOf<{ length: 1 }>();

		expectTypeOf(Umzug).toBeConstructibleWith({
			migrations: { glob: '*/*.js' },
			storage: memoryStorage(),
		});
		expectTypeOf(Umzug).toBeConstructibleWith({
			migrations: { glob: ['*/*.js', { cwd: 'x/y/z' }] },
		});
		expectTypeOf(Umzug).toBeConstructibleWith({
			migrations: { glob: ['*/*.js', { ignore: ['**/*ignoreme*.js'] }] },
		});
		expectTypeOf(Umzug).toBeConstructibleWith({
			migrations: [
				{ name: 'm1', up: async () => {} },
				{ name: 'm2', up: async () => {}, down: async () => {} },
			],
		});
		expectTypeOf(Umzug).toBeConstructibleWith({
			migrations: [],
			storage: memoryStorage(),
			context: { foo: 123 },
			logging: (...args) => expectTypeOf(args).toEqualTypeOf<any[]>(),
		});
	});

	test('up and down', () => {
		expectTypeOf(Umzug).instance.toHaveProperty('up').toBeCallableWith({ to: 'migration123' });

		expectTypeOf(Umzug).instance.toHaveProperty('down').toBeCallableWith({ to: 'migration123' });

		expectTypeOf(Umzug).instance.toHaveProperty('down').toBeCallableWith({ to: 0 });

		// can't go up "to" 0
		// @ts-expect-error
		expectTypeOf(Umzug).instance.toHaveProperty('up').toBeCallableWith({ to: 0 });

		// `{ to: 0 }` is a special case. `{ to: 1 }` shouldn't be allowed:

		// @ts-expect-error
		expectTypeOf(Umzug).instance.toHaveProperty('down').toBeCallableWith({ to: 1 });

		// @ts-expect-error
		expectTypeOf(Umzug).instance.toHaveProperty('up').toBeCallableWith({ to: 1 });
	});

	test('pending', () => {
		expectTypeOf(Umzug).instance.toHaveProperty('pending').returns.resolves.items.toEqualTypeOf<{
			name: string;
			path?: string;
			up: () => Promise<unknown>;
			down?: () => Promise<unknown>;
		}>();
	});

	test('executed', () => {
		expectTypeOf(Umzug).instance.toHaveProperty('executed').returns.resolves.items.toEqualTypeOf<{
			name: string;
			path?: string;
			up: () => Promise<unknown>;
			down?: () => Promise<unknown>;
		}>();
	});

	test('migration type', () => {
		const umzug = new Umzug({
			migrations: { glob: '*/*.ts' },
			context: { someCustomSqlClient: {} },
		});

		expectTypeOf<MigrationFn<typeof umzug>>()
			.parameter(0)
			.toMatchTypeOf<{ name: string; path?: string; context: { someCustomSqlClient: {} } }>();

		expectTypeOf<MigrationFn<typeof umzug>>().returns.toEqualTypeOf<Promise<unknown>>();
	});

	test('custom resolver type', () => {
		// eslint-disable-next-line no-new
		new Umzug({
			migrations: {
				glob: '*/*.ts',
				resolve: params => {
					expectTypeOf(params).toEqualTypeOf<{ name: string; path: string; context: { someCustomSqlClient: {} } }>();
					return { name: '', up: async () => {} };
				},
			},
			context: { someCustomSqlClient: {} },
		});
	});

	test(`extend function doesn't allow modifying migrations array`, () => {
		const parent = new Umzug({ migrations: [] });
		parent.extend(migrations => {
			expectTypeOf(migrations).not.toHaveProperty('reverse');
			return migrations.slice();
		});
	});
});

describe('error cases', () => {
	test('invalid storage', () => {
		expect(
			() =>
				new Umzug({
					migrations: [],
					storage: {} as any,
				})
		).toThrowError(/Invalid umzug storage/);
	});
	test('unresolvable file', async () => {
		const syncer = fsSyncer(join(__dirname, 'generated/umzug/errors/unresolvable'), {
			'migration1.txt': 'create table somehow',
		});
		syncer.sync();

		const umzug = new Umzug({
			migrations: {
				glob: ['*.txt', { cwd: syncer.baseDir }],
			},
		});

		await expect(umzug.up()).rejects.toThrowError(
			/No resolver specified for file .*migration1.txt. See docs for guidance on how to write a custom resolver./
		);
	});

	test('typo in "to"', async () => {
		const syncer = fsSyncer(join(__dirname, 'generated/umzug/errors/typo'), {
			'migration1.js': 'exports.up = () => {}',
		});
		syncer.sync();

		const umzug = new Umzug({
			migrations: {
				glob: ['*.txt', { cwd: syncer.baseDir }],
			},
		});

		await expect(umzug.up({ to: 'typo' })).rejects.toThrowError(/Couldn't find migration with name "typo"/);
	});
});

describe('events', () => {
	test('events', async () => {
		const mock = jest.fn();
		const spy = (label: string) => (...args) => mock(label, ...args);

		const umzug = new Umzug({
			migrations: [
				{ name: 'm1', up: spy('up-m1'), down: spy('down-m1') },
				{ name: 'm2', up: spy('up-m2'), down: spy('down-m2') },
			],
		});

		// `.addListener` and `.on` are aliases - use both to make sure they're wired up properly
		umzug.addListener('migrating', spy('migrating'));
		umzug.on('migrated', spy('migrated'));

		const revertingSpy = spy('reverting');
		umzug.addListener('reverting', revertingSpy);
		umzug.on('reverted', spy('reverted'));

		await umzug.up();

		expect(mock.mock.calls).toMatchObject([
			['migrating', 'm1', { name: 'm1' }],
			['up-m1'],
			['migrated', 'm1', { name: 'm1' }],
			['migrating', 'm2', { name: 'm2' }],
			['up-m2'],
			['migrated', 'm2', { name: 'm2' }],
		]);

		mock.mockClear();

		await umzug.down();

		expect(mock.mock.calls).toMatchObject([
			['reverting', 'm2', { name: 'm2' }],
			['down-m2'],
			['reverted', 'm2', { name: 'm2' }],
		]);

		mock.mockClear();

		umzug.removeListener('reverting', revertingSpy);

		await umzug.down();

		expect(mock.mock.calls).toMatchObject([
			// `reverting` shouldn't be here because the listener was removed
			['down-m1'],
			['reverted', 'm1', { name: 'm1' }],
		]);
	});
});
