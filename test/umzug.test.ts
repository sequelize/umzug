import { memoryStorage, RerunBehavior, Umzug } from '../src';
import * as path from 'path';
import { fsSyncer } from 'fs-syncer';
import { expectTypeOf } from 'expect-type';
import * as VError from 'verror';

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

		const syncer = fsSyncer(path.join(__dirname, 'generated/umzug/globjs'), {
			'm1.js': `exports.up = async params => console.log('up1', params)`,
		});
		syncer.sync();

		const umzug = new Umzug({
			migrations: {
				glob: ['*.js', { cwd: syncer.baseDir }],
			},
			context: { someCustomSqlClient: {} },
			logger: undefined,
		});

		await umzug.up();

		expect(names(await umzug.executed())).toEqual(['m1.js']);
		expect(spy).toHaveBeenCalledTimes(1);
		expect(spy).toHaveBeenNthCalledWith(1, 'up1', {
			context: { someCustomSqlClient: {} },
			name: 'm1.js',
			path: path.join(syncer.baseDir, 'm1.js'),
		});
	});
});

describe('alternate migration inputs', () => {
	test('with file globbing', async () => {
		const spy = jest.fn();

		const syncer = fsSyncer(path.join(__dirname, 'generated/umzug/glob'), {
			'migration1.sql': 'select true',
			'migration2.sql': 'select true',
			'should-be-ignored.txt': 'abc',
			'migration3.sql': 'select true',
		});
		syncer.sync();

		const umzug = new Umzug({
			migrations: {
				glob: ['*.sql', { cwd: syncer.baseDir }],
				resolve: params => ({
					...params,
					up: async () => spy(params),
				}),
			},
			context: { someCustomSqlClient: {} },
			logger: undefined,
		});

		await umzug.up();

		expect(names(await umzug.executed())).toEqual(['migration1.sql', 'migration2.sql', 'migration3.sql']);
		expect(spy).toHaveBeenCalledTimes(3);
		expect(spy).toHaveBeenNthCalledWith(1, {
			context: { someCustomSqlClient: {} },
			name: 'migration1.sql',
			path: path.join(syncer.baseDir, 'migration1.sql'),
		});
	});

	test('up and down functions using `resolve` should receive parameters', async () => {
		const spy = jest.fn();

		const syncer = fsSyncer(path.join(__dirname, 'generated/umzug/parameterless-fns'), {
			'migration1.sql': 'select true',
		});
		syncer.sync();

		const context = { someCustomSqlClient: {} };

		const umzug = new Umzug({
			migrations: {
				glob: ['*.sql', { cwd: syncer.baseDir }],
				resolve: resolveParams => ({
					...resolveParams,
					up: async upParams => spy('up', { resolveParams, upParams }),
					down: async downParams => spy('down', { resolveParams, downParams }),
				}),
			},
			context,
			logger: undefined,
		});

		await umzug.up();

		expect(spy).toHaveBeenCalledTimes(1);
		expect(spy).toHaveBeenNthCalledWith(1, 'up', {
			resolveParams: { name: 'migration1.sql', path: path.join(syncer.baseDir, 'migration1.sql'), context },
			upParams: { name: 'migration1.sql', path: path.join(syncer.baseDir, 'migration1.sql'), context },
		});

		spy.mockClear();

		await umzug.down();

		expect(spy).toHaveBeenCalledTimes(1);
		expect(spy).toHaveBeenNthCalledWith(1, 'down', {
			resolveParams: { name: 'migration1.sql', path: path.join(syncer.baseDir, 'migration1.sql'), context },
			downParams: { name: 'migration1.sql', path: path.join(syncer.baseDir, 'migration1.sql'), context },
		});
	});

	test('up and down "to"', async () => {
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
			logger: undefined,
		});

		await umzug.up();

		expect(names(await umzug.executed())).toEqual(['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7']);
		expect(names(await umzug.pending())).toEqual([]);

		await umzug.down({});
		expect(names(await umzug.executed())).toEqual(['m1', 'm2', 'm3', 'm4', 'm5', 'm6']);
		expect(names(await umzug.pending())).toEqual(['m7']);

		await umzug.down({ to: undefined });
		expect(names(await umzug.executed())).toEqual(['m1', 'm2', 'm3', 'm4', 'm5']);
		expect(names(await umzug.pending())).toEqual(['m6', 'm7']);

		await umzug.down({ to: 'm3' });
		expect(names(await umzug.executed())).toEqual(['m1', 'm2']);
		expect(names(await umzug.pending())).toEqual(['m3', 'm4', 'm5', 'm6', 'm7']);

		await umzug.down({ to: 0 });
		expect(names(await umzug.executed())).toEqual([]);
		expect(names(await umzug.pending())).toEqual(['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7']);

		await umzug.up({ to: 'm4' });
		expect(names(await umzug.executed())).toEqual(['m1', 'm2', 'm3', 'm4']);
		expect(names(await umzug.pending())).toEqual(['m5', 'm6', 'm7']);
	});

	test('up and down with step', async () => {
		const umzug = new Umzug({
			migrations: [
				{ name: 'm1', up: async () => {} },
				{ name: 'm2', up: async () => {} },
				{ name: 'm3', up: async () => {} },
				{ name: 'm4', up: async () => {} },
			],
			logger: undefined,
		});

		await umzug.up({ step: 3 });

		expect(names(await umzug.executed())).toEqual(['m1', 'm2', 'm3']);
		expect(names(await umzug.pending())).toEqual(['m4']);

		await umzug.down({ step: 2 });

		expect(names(await umzug.executed())).toEqual(['m1']);
		expect(names(await umzug.pending())).toEqual(['m2', 'm3', 'm4']);
	});

	test('up and down options', async () => {
		const spy = jest.fn();
		const umzug = new Umzug({
			migrations: [...new Array(7)]
				.map((_, i) => `m${i + 1}`)
				.map(name => ({
					name,
					up: async () => spy('up-' + name),
					down: async () => spy('down-' + name),
				})),
			logger: undefined,
		});

		await umzug.up({ migrations: ['m2', 'm4'] });

		expect(names(await umzug.executed())).toEqual(['m2', 'm4']);
		expect(spy.mock.calls).toEqual([['up-m2'], ['up-m4']]);

		await expect(umzug.up({ migrations: ['m2', 'm4'] })).rejects.toThrowError(
			/Couldn't find migration to apply with name "m2"/
		);

		// rerun behavior 'SKIP' silently ignores already-executed migrations
		await umzug.up({ migrations: ['m2', 'm4'], rerun: RerunBehavior.SKIP });
		expect(names(await umzug.executed())).toEqual(['m2', 'm4']);
		expect(spy.mock.calls).toEqual([['up-m2'], ['up-m4']]);

		// rerun behavior 'ALLOW' runs already-executed migrations again
		await umzug.up({ migrations: ['m2', 'm4'], rerun: RerunBehavior.ALLOW });

		expect(names(await umzug.executed())).toEqual(['m2', 'm4']);
		expect(spy.mock.calls).toEqual([['up-m2'], ['up-m4'], ['up-m2'], ['up-m4']]);

		// you can use migration names to run migrations in the "wrong" order:
		await umzug.up({ migrations: ['m5', 'm3'], rerun: RerunBehavior.ALLOW });

		expect(names(await umzug.executed())).toEqual(['m2', 'm3', 'm4', 'm5']);
		expect(spy.mock.calls).toEqual([['up-m2'], ['up-m4'], ['up-m2'], ['up-m4'], ['up-m5'], ['up-m3']]);

		// invalid migration names result in an error:
		await expect(umzug.up({ migrations: ['m1', 'typo'], rerun: RerunBehavior.ALLOW })).rejects.toThrowError(
			/Couldn't find migration to apply with name "typo"/
		);
		// even though m1 _is_ a valid name, it shouldn't have been called - all listed migrations are verified before running any
		expect(spy.mock.calls).toEqual([['up-m2'], ['up-m4'], ['up-m2'], ['up-m4'], ['up-m5'], ['up-m3']]);
		expect(JSON.stringify(spy.mock.calls)).not.toContain('up-m1');

		await umzug.up();

		expect(names(await umzug.executed())).toEqual(['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7']);

		spy.mockClear();

		await umzug.down({ migrations: ['m1', 'm3', 'm5', 'm7'] });
		expect(names(await umzug.executed())).toEqual(['m2', 'm4', 'm6']);
		expect(spy.mock.calls).toEqual([['down-m1'], ['down-m3'], ['down-m5'], ['down-m7']]);

		// rerun behavior 'SKIP' ignores down migrations that have already been reverted
		await umzug.down({ migrations: ['m1', 'm3', 'm5', 'm7'], rerun: RerunBehavior.SKIP });
		expect(names(await umzug.executed())).toEqual(['m2', 'm4', 'm6']);
		expect(spy.mock.calls).toEqual([['down-m1'], ['down-m3'], ['down-m5'], ['down-m7']]);

		await expect(umzug.down({ migrations: ['m1', 'm3', 'm5', 'm7'] })).rejects.toThrowError(
			/Couldn't find migration to apply with name "m1"/
		);

		await umzug.down({ migrations: ['m1', 'm3', 'm5', 'm7'], rerun: RerunBehavior.ALLOW });
		expect(names(await umzug.executed())).toEqual(['m2', 'm4', 'm6']);
		expect(spy.mock.calls).toEqual([
			['down-m1'],
			['down-m3'],
			['down-m5'],
			['down-m7'],
			['down-m1'],
			['down-m3'],
			['down-m5'],
			['down-m7'],
		]);
	});

	test('up and down return migration meta array', async () => {
		const umzug = new Umzug({
			migrations: [
				{ name: 'm1', path: 'm1.sql', up: async () => {} },
				{ name: 'm2', path: 'm2.sql', up: async () => {} },
			],
			logger: undefined,
		});

		const upResults = await umzug.up();
		expect(upResults).toEqual([
			{ name: 'm1', path: 'm1.sql' },
			{ name: 'm2', path: 'm2.sql' },
		]);

		const downResults = await umzug.down({ to: 0 });
		expect(downResults).toEqual([
			{ name: 'm2', path: 'm2.sql' },
			{ name: 'm1', path: 'm1.sql' },
		]);
	});

	test('custom storage', async () => {
		const spy = jest.fn();

		const umzug = new Umzug({
			migrations: [{ name: 'm1', up: async () => {} }],
			context: { someCustomSqlClient: {} },
			storage: {
				executed: async (...args) => spy('executed', ...args),
				logMigration: async (...args) => spy('logMigration', ...args),
				unlogMigration: async (...args) => spy('unlogMigration', ...args),
			},
			logger: undefined,
		});

		await umzug.up();

		expect(spy.mock.calls).toEqual([
			['executed', { context: { someCustomSqlClient: {} } }],
			['logMigration', 'm1', { name: 'm1', context: { someCustomSqlClient: {} } }],
		]);

		spy.mockClear();
		spy.mockReturnValueOnce(['m1']);

		await umzug.down();

		expect(spy.mock.calls).toEqual([
			['executed', { context: { someCustomSqlClient: {} } }],
			['unlogMigration', 'm1', { name: 'm1', context: { someCustomSqlClient: {} } }],
		]);
	});

	test('with migrations array', async () => {
		const spy = jest.fn();

		const umzug = new Umzug({
			migrations: [
				{
					name: 'migration1',
					up: async () => spy('migration1-up'),
				},
				{
					name: 'migration2',
					up: async () => spy('migration2-up'),
				},
			],
			logger: undefined,
		});

		await umzug.up();

		expect(names(await umzug.executed())).toEqual(['migration1', 'migration2']);
		expect(spy).toHaveBeenCalledTimes(2);
		expect(spy).toHaveBeenNthCalledWith(1, 'migration1-up');
	});

	test('with function returning migrations array', async () => {
		const spy = jest.fn();

		const umzug = new Umzug({
			migrations: context => {
				expect(context).toEqual({ someCustomSqlClient: {} });
				return [
					{
						name: 'migration1',
						up: async () => spy('migration1-up'),
					},
					{
						name: 'migration2',
						up: async () => spy('migration2-up'),
					},
				];
			},
			context: { someCustomSqlClient: {} },
			logger: undefined,
		});

		await umzug.up();

		expect(names(await umzug.executed())).toEqual(['migration1', 'migration2']);
		expect(spy).toHaveBeenCalledTimes(2);
		expect(spy).toHaveBeenNthCalledWith(1, 'migration1-up');
	});

	test('errors are wrapped helpfully', async () => {
		// Raw errors usually won't tell you which migration threw. This test ensures umzug adds that information.
		const umzug = new Umzug({
			migrations: [
				{
					name: 'm1',
					up: async () => {},
					down: async () => Promise.reject(new Error('Some cryptic failure')),
				},
				{
					name: 'm2',
					up: async () => Promise.reject(new Error('Some cryptic failure')),
					down: async () => {},
				},
			],
			logger: undefined,
		});

		await expect(umzug.up()).rejects.toThrowErrorMatchingInlineSnapshot(
			`"up migration m2 failed: Original error: Some cryptic failure"`
		);

		await expect(umzug.down()).rejects.toThrowErrorMatchingInlineSnapshot(
			`"down migration m1 failed: Original error: Some cryptic failure"`
		);
	});

	test('Error causes are propagated properly', async () => {
		const umzug = new Umzug({
			migrations: [
				{
					name: 'm1',
					up: async () => {},
					down: async () => Promise.reject(new VError({ info: { extra: 'detail' } }, 'Some cryptic failure')),
				},
				{
					name: 'm2',
					up: async () => Promise.reject(new VError({ info: { extra: 'detail' } }, 'Some cryptic failure')),
					down: async () => {},
				},
			],
			logger: undefined,
		});

		await expect(umzug.up()).rejects.toThrowErrorMatchingInlineSnapshot(
			`"up migration m2 failed: Some cryptic failure"`
		);

		// slightly weird format verror uses, not worth validating much more than that the `cause` is captured
		await expect(umzug.up()).rejects.toMatchObject({
			jse_cause: {
				jse_info: { extra: 'detail' },
			},
		});

		await expect(umzug.down()).rejects.toThrowErrorMatchingInlineSnapshot(
			`"down migration m1 failed: Some cryptic failure"`
		);

		await expect(umzug.down()).rejects.toMatchObject({
			jse_cause: {
				jse_info: { extra: 'detail' },
			},
		});
	});

	test('non-error throwables are wrapped helpfully', async () => {
		// Migration errors usually won't tell you which migration threw. This test ensures umzug adds that information.
		const umzug = new Umzug({
			migrations: [
				{
					name: 'm1',
					up: async () => {},
					// eslint-disable-next-line prefer-promise-reject-errors
					down: async () => Promise.reject('Some cryptic failure'),
				},
				{
					name: 'm2',
					// eslint-disable-next-line prefer-promise-reject-errors
					up: async () => Promise.reject('Some cryptic failure'),
					down: async () => {},
				},
			],
			logger: undefined,
		});

		await expect(umzug.up()).rejects.toThrowErrorMatchingInlineSnapshot(
			`"up migration m2 failed: Non-error value thrown. See info for full props: Some cryptic failure"`
		);

		await expect(umzug.down()).rejects.toThrowErrorMatchingInlineSnapshot(
			`"down migration m1 failed: Non-error value thrown. See info for full props: Some cryptic failure"`
		);
	});

	test('typescript migration files', async () => {
		const syncer = fsSyncer(path.join(__dirname, 'generated/umzug/typescript'), {
			'm1.ts': `export const up = () => {}; export const down = () => {}`,
			'm2.ts': `throw SyntaxError('Fake syntax error to simulate typescript modules not being registered')`,
		});
		syncer.sync();

		const umzug = new Umzug({
			migrations: {
				glob: ['*.ts', { cwd: syncer.baseDir }],
			},
			logger: undefined,
		});

		expect([names(await umzug.pending()), names(await umzug.executed())]).toEqual([['m1.ts', 'm2.ts'], []]);

		await umzug.up({ to: 'm1.ts' });

		expect([names(await umzug.pending()), names(await umzug.executed())]).toEqual([['m2.ts'], ['m1.ts']]);

		await expect(umzug.up()).rejects.toThrowErrorMatchingInlineSnapshot(`
			"up migration m2.ts failed: Original error: Fake syntax error to simulate typescript modules not being registered

			TypeScript files can be required by adding \`ts-node\` as a dependency and calling \`require('ts-node/register')\` at the program entrypoint before running migrations."
		`);
	});

	test('with custom file globbing options', async () => {
		const spy = jest.fn();

		const syncer = fsSyncer(path.join(__dirname, 'generated/umzug/glob'), {
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
				resolve: params => ({
					...params,
					up: async () => spy(params),
				}),
			},
			context: { someCustomSqlClient: {} },
			logger: undefined,
		});

		await umzug.up();

		expect(names(await umzug.executed())).toEqual(['migration1.sql', 'migration2.sql', 'migration3.sql']);
		expect(spy).toHaveBeenCalledTimes(3);
		expect(spy).toHaveBeenNthCalledWith(1, {
			context: { someCustomSqlClient: {} },
			name: 'migration1.sql',
			path: path.join(syncer.baseDir, 'migration1.sql'),
		});
	});

	test('allows customization via getMigrations', async () => {
		const spy = jest.fn();

		const syncer = fsSyncer(path.join(__dirname, 'generated/umzug/customOrdering'), {
			'migration1.sql': 'select true',
			'migration2.sql': 'select true',
			'should-be-ignored.txt': 'abc',
			'migration3.sql': 'select true',
		});
		syncer.sync();

		const parent = new Umzug({
			migrations: {
				glob: ['*.sql', { cwd: syncer.baseDir }],
				resolve: ({ context, ...params }) => ({
					...params,
					up: async () => context.spy(params),
				}),
			},
			context: { spy },
			logger: undefined,
		});

		const umzug = parent.extend(migrations => migrations.slice().reverse());

		await umzug.up();

		expect(names(await umzug.executed())).toEqual(['migration3.sql', 'migration2.sql', 'migration1.sql']);
		expect(spy).toHaveBeenCalledTimes(3);
		expect(spy).toHaveBeenNthCalledWith(1, {
			name: 'migration3.sql',
			path: path.join(syncer.baseDir, 'migration3.sql'),
		});
	});

	test('supports nested directories via getMigrations', async () => {
		const spy = jest.fn();

		// folder structure splitting migrations into separate directories, with the filename determining the order:
		const syncer = fsSyncer(path.join(__dirname, 'generated/umzug/customOrdering'), {
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
				resolve: params => ({
					...params,
					up: async () => spy(params),
				}),
			},
			logger: undefined,
		});

		const umzug = withDefaultOrdering.extend(standard => {
			return standard.slice().sort((a, b) => a.name.localeCompare(b.name));
		});

		await umzug.up();

		expect(names(await umzug.executed())).toEqual(['m1.sql', 'm2.sql', 'm3.sql', 'm4.sql']);
		expect(spy).toHaveBeenCalledTimes(4);
		expect(spy).toHaveBeenNthCalledWith(1, {
			name: 'm1.sql',
			path: path.join(syncer.baseDir, 'directory1/m1.sql'),
		});
		expect(spy).toHaveBeenNthCalledWith(2, {
			name: 'm2.sql',
			path: path.join(syncer.baseDir, 'deeply/nested/directory2/m2.sql'),
		});
	});
});

describe('types', () => {
	test('constructor function', () => {
		expectTypeOf(Umzug).constructorParameters.toMatchTypeOf<{ length: 1 }>();

		expectTypeOf(Umzug).toBeConstructibleWith({
			migrations: { glob: '*/*.js' },
			storage: memoryStorage(),
			logger: undefined,
		});
		expectTypeOf(Umzug).toBeConstructibleWith({
			migrations: { glob: ['*/*.js', { cwd: 'x/y/z' }] },
			logger: undefined,
		});
		expectTypeOf(Umzug).toBeConstructibleWith({
			migrations: { glob: ['*/*.js', { ignore: ['**/*ignoreme*.js'] }] },
			logger: undefined,
		});
		expectTypeOf(Umzug).toBeConstructibleWith({
			migrations: [
				{ name: 'm1', up: async () => {} },
				{ name: 'm2', up: async () => {}, down: async () => {} },
			],
			logger: undefined,
		});
		expectTypeOf(Umzug).toBeConstructibleWith({
			migrations: [],
			storage: memoryStorage(),
			context: { foo: 123 },
			logger: console,
		});

		expectTypeOf(Umzug)
			.constructorParameters.toHaveProperty('0')
			.toHaveProperty('logger')
			.toMatchTypeOf<undefined | Pick<Console, 'info' | 'warn' | 'error'>>();

		expectTypeOf(Umzug).toBeConstructibleWith({
			migrations: [],
			storage: memoryStorage(),
			context: { foo: 123 },
			logger: {
				...console,
				info: (...args) => expectTypeOf(args).toEqualTypeOf<[Record<string, unknown>]>(),
			},
		});
	});

	test('rerun behavior is a map of its keys to themselves', () => {
		expectTypeOf(RerunBehavior).toEqualTypeOf<{ readonly [K in RerunBehavior]: K }>();
	});

	test('up and down', () => {
		const up = expectTypeOf(Umzug).instance.toHaveProperty('up');
		const down = expectTypeOf(Umzug).instance.toHaveProperty('down');

		up.toBeCallableWith({ to: 'migration123' });

		up.toBeCallableWith({ migrations: ['m1'], rerun: RerunBehavior.ALLOW });
		up.toBeCallableWith({ migrations: ['m1'], rerun: RerunBehavior.SKIP });
		up.toBeCallableWith({ migrations: ['m1'], rerun: RerunBehavior.THROW });

		up.toBeCallableWith({ migrations: ['m1'], rerun: 'ALLOW' });
		up.toBeCallableWith({ migrations: ['m1'], rerun: 'SKIP' });
		up.toBeCallableWith({ migrations: ['m1'], rerun: 'THROW' });

		// @ts-expect-error (don't allow general strings for rerun behavior)
		up.toBeCallableWith({ migrations: ['m1'], rerun: 'xyztypo' });

		// @ts-expect-error (rerun must be specified with `migrations`)
		up.toBeCallableWith({ rerun: 'ALLOW' });

		// @ts-expect-error (can't go up "to" 0)
		up.toBeCallableWith({ to: 0 });

		down.toBeCallableWith({ to: 'migration123' });

		down.toBeCallableWith({ migrations: ['m1'], rerun: RerunBehavior.ALLOW });
		down.toBeCallableWith({ migrations: ['m1'], rerun: RerunBehavior.SKIP });
		down.toBeCallableWith({ migrations: ['m1'], rerun: RerunBehavior.THROW });

		down.toBeCallableWith({ migrations: ['m1'], rerun: 'ALLOW' });
		down.toBeCallableWith({ migrations: ['m1'], rerun: 'SKIP' });
		down.toBeCallableWith({ migrations: ['m1'], rerun: 'THROW' });

		// @ts-expect-error (don't allow general strings for rerun behavior)
		down.toBeCallableWith({ migrations: ['m1'], rerun: 'xyztypo' });

		// @ts-expect-error (rerun can only be specified with `migrations`)
		down.toBeCallableWith({ rerun: 'ALLOW' });

		down.toBeCallableWith({ to: 0 });

		// @ts-expect-error (`{ to: 0 }` is a special case. `{ to: 1 }` shouldn't be allowed)
		down.toBeCallableWith({ to: 1 });

		// @ts-expect-error (`{ to: 0 }` is a special case. `{ to: 1 }` shouldn't be allowed)
		up.toBeCallableWith({ to: 1 });

		up.returns.toEqualTypeOf<Promise<Array<{ name: string; path?: string }>>>();
		down.returns.toEqualTypeOf<Promise<Array<{ name: string; path?: string }>>>();
	});

	test('pending', () => {
		expectTypeOf(Umzug).instance.toHaveProperty('pending').returns.resolves.items.toEqualTypeOf<{
			name: string;
			path?: string;
		}>();
	});

	test('executed', () => {
		expectTypeOf(Umzug).instance.toHaveProperty('executed').returns.resolves.items.toEqualTypeOf<{
			name: string;
			path?: string;
		}>();
	});

	test('migration type', () => {
		const umzug = new Umzug({
			migrations: { glob: '*/*.ts' },
			context: { someCustomSqlClient: {} },
			logger: undefined,
		});

		type Migration = typeof umzug._types.migration;

		expectTypeOf<Migration>()
			.parameter(0)
			.toMatchTypeOf<{ name: string; path?: string; context: { someCustomSqlClient: {} } }>();

		expectTypeOf<Migration>().returns.toEqualTypeOf<Promise<unknown>>();
	});

	test('custom resolver type', () => {
		// eslint-disable-next-line no-new
		new Umzug({
			migrations: {
				glob: '*/*.ts',
				resolve: params => {
					expectTypeOf(params).toEqualTypeOf<{ name: string; path?: string; context: { someCustomSqlClient: {} } }>();
					return { name: '', up: async () => {} };
				},
			},
			context: { someCustomSqlClient: {} },
			logger: undefined,
		});
	});

	test(`extend function doesn't allow modifying migrations array`, () => {
		const parent = new Umzug({ migrations: [], logger: undefined });
		parent.extend(migrations => {
			expectTypeOf(migrations).not.toHaveProperty('reverse');
			return migrations.slice();
		});
	});

	test('event types', () => {
		const umzug = new Umzug({
			migrations: [],
			context: { someCustomSqlClient: {} },
			logger: undefined,
		});

		umzug.on('migrating', params => {
			expectTypeOf(params.name).toBeString();
			expectTypeOf(params.path).toEqualTypeOf<string | undefined>();
			expectTypeOf(params.context).toEqualTypeOf({ someCustomSqlClient: {} });
		});

		umzug.on('migrated', params => {
			expectTypeOf(params.name).toBeString();
			expectTypeOf(params.path).toEqualTypeOf<string | undefined>();
			expectTypeOf(params.context).toEqualTypeOf({ someCustomSqlClient: {} });
		});

		umzug.on('reverting', params => {
			expectTypeOf(params.name).toBeString();
			expectTypeOf(params.path).toEqualTypeOf<string | undefined>();
			expectTypeOf(params.context).toEqualTypeOf({ someCustomSqlClient: {} });
		});

		umzug.on('reverted', params => {
			expectTypeOf(params.name).toBeString();
			expectTypeOf(params.path).toEqualTypeOf<string | undefined>();
			expectTypeOf(params.context).toEqualTypeOf({ someCustomSqlClient: {} });
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
					logger: undefined,
				})
		).toThrowError(/Invalid umzug storage/);
	});
	test('unresolvable file', async () => {
		const syncer = fsSyncer(path.join(__dirname, 'generated/umzug/errors/unresolvable'), {
			'migration1.txt': 'create table somehow',
		});
		syncer.sync();

		const umzug = new Umzug({
			migrations: {
				glob: ['*.txt', { cwd: syncer.baseDir }],
			},
			logger: undefined,
		});

		await expect(umzug.up()).rejects.toThrowError(
			/No resolver specified for file .*migration1.txt. See docs for guidance on how to write a custom resolver./
		);
	});

	test('typo in "to"', async () => {
		const syncer = fsSyncer(path.join(__dirname, 'generated/umzug/errors/typo'), {
			'migration1.js': 'exports.up = () => {}',
		});
		syncer.sync();

		const umzug = new Umzug({
			migrations: {
				glob: ['*.txt', { cwd: syncer.baseDir }],
			},
			logger: undefined,
		});

		await expect(umzug.up({ to: 'typo' })).rejects.toThrowError(/Couldn't find migration to apply with name "typo"/);
	});
});

describe('events', () => {
	test('events', async () => {
		const mock = jest.fn();
		const spy = (label: string) => (...args: unknown[]) => mock(label, ...args);

		const umzug = new Umzug({
			migrations: [
				{ name: 'm1', up: spy('up-m1'), down: spy('down-m1') },
				{ name: 'm2', up: spy('up-m2'), down: spy('down-m2') },
			],
			logger: undefined,
		});

		umzug.on('migrating', spy('migrating'));
		umzug.on('migrated', spy('migrated'));

		const revertingSpy = spy('reverting');
		umzug.on('reverting', revertingSpy);
		umzug.on('reverted', spy('reverted'));

		await umzug.up();

		expect(mock.mock.calls).toMatchObject([
			['migrating', { name: 'm1' }],
			['up-m1', { name: 'm1' }],
			['migrated', { name: 'm1' }],
			['migrating', { name: 'm2' }],
			['up-m2', { name: 'm2' }],
			['migrated', { name: 'm2' }],
		]);

		mock.mockClear();

		await umzug.down();

		expect(mock.mock.calls).toMatchObject([
			['reverting', { name: 'm2' }],
			['down-m2', { name: 'm2' }],
			['reverted', { name: 'm2' }],
		]);

		mock.mockClear();

		umzug.off('reverting', revertingSpy);

		await umzug.down();

		expect(mock.mock.calls).toMatchObject([
			// `reverting` shouldn't be here because the listener was removed
			['down-m1', { name: 'm1' }],
			['reverted', { name: 'm1' }],
		]);
	});
});

describe('custom logger', () => {
	test('uses custom logger', async () => {
		const spy = jest.fn();
		const umzug = new Umzug({
			migrations: [{ name: 'm1', up: async () => {} }],
			logger: {
				info: spy,
				warn: spy,
				error: spy,
				debug: spy,
			},
		});

		await umzug.up();

		expect(spy).toHaveBeenCalledTimes(2);
		expect(
			spy.mock.calls.map(([c]) => ({ ...c, durationSeconds: c.durationSeconds && Math.floor(c.durationSeconds) }))
		).toEqual([
			{ event: 'migrating', name: 'm1' },
			{ event: 'migrated', name: 'm1', durationSeconds: 0 },
		]);
	});
});
