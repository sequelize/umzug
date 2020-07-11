import { UmzugLegacy as Umzug, Migration, migrationsList, memoryStorage } from '../src';
import pkgDir = require('pkg-dir');
import { expectTypeOf } from 'expect-type';

test('Compiles & exports correctly', async () => {
	const dir = await pkgDir(__dirname);

	let requiredJS;

	expect(() => {
		requiredJS = require(dir);
	}).not.toThrow();

	expect(requiredJS.Umzug).toBeTruthy();
	expect(requiredJS.Migration).toBeTruthy();
	expect(requiredJS.migrationsList).toBeTruthy();
});

test('type', () => {
	expectTypeOf(Umzug).toBeConstructibleWith();
	expectTypeOf(Umzug).toBeConstructibleWith({ storage: memoryStorage() });
	expectTypeOf(Umzug).toBeConstructibleWith({ logging: false });
	// eslint-disable-next-line no-console
	expectTypeOf(Umzug).toBeConstructibleWith({ logging: console.log });
	expectTypeOf(Umzug).toBeConstructibleWith({ migrationSorting: (a, b) => a.localeCompare(b) });
	expectTypeOf(Umzug).toBeConstructibleWith({ migrations: { path: 'test/abc' } });

	expectTypeOf(Umzug).instance.toHaveProperty('up').toBeCallableWith({ to: 'migration123' });
	expectTypeOf(Umzug).instance.toHaveProperty('up').toBeCallableWith({ to: 0 });

	expectTypeOf(Umzug).instance.toHaveProperty('down').toBeCallableWith({ to: 'migration123' });
	expectTypeOf(Umzug).instance.toHaveProperty('down').toBeCallableWith({ to: 0 });

	// `{ to: 0 }` is a special case. `{ to: 1 }` shouldn't be allowed:

	// @ts-expect-error
	expectTypeOf(Umzug).instance.toHaveProperty('up').toBeCallableWith({ to: 1 });

	// @ts-expect-error
	expectTypeOf(Umzug).instance.toHaveProperty('down').toBeCallableWith({ to: 1 });
});

test('migrationsList() works', async () => {
	const executed = [];

	const umzug = new Umzug({
		storage: memoryStorage(),
		migrations: migrationsList([
			{
				name: '00-first-migration',
				async up(): Promise<void> {
					executed.push('00-first-migration-up');
				},
				async down(): Promise<void> {
					executed.push('00-first-migration-down');
				},
			},
			{
				name: '01-second-migration',
				async up(): Promise<void> {
					executed.push('01-second-migration-up');
				},
				async down(): Promise<void> {
					executed.push('01-second-migration-down');
				},
			},
		]),
	});

	const names = (migrations: Migration[]) => migrations.map(m => m.file);

	// Before anything
	expect(executed).toEqual([]);
	expect(names(await umzug.executed())).toEqual([]);
	expect(names(await umzug.pending())).toEqual(['00-first-migration', '01-second-migration']);

	// Up: all at once
	expect(names(await umzug.up())).toEqual(['00-first-migration', '01-second-migration']);
	expect(executed).toEqual(['00-first-migration-up', '01-second-migration-up']);
	expect(names(await umzug.executed())).toEqual(['00-first-migration', '01-second-migration']);
	expect(names(await umzug.pending())).toEqual([]);

	// Down: one by one
	expect(names(await umzug.down())).toEqual(['01-second-migration']);
	expect(executed).toEqual(['00-first-migration-up', '01-second-migration-up', '01-second-migration-down']);
	expect(names(await umzug.executed())).toEqual(['00-first-migration']);
	expect(names(await umzug.pending())).toEqual(['01-second-migration']);

	expect(names(await umzug.down())).toEqual(['00-first-migration']);
	expect(executed).toEqual([
		'00-first-migration-up',
		'01-second-migration-up',
		'01-second-migration-down',
		'00-first-migration-down',
	]);
	expect(names(await umzug.executed())).toEqual([]);
	expect(names(await umzug.pending())).toEqual(['00-first-migration', '01-second-migration']);
});

test('migration sort', async () => {
	const executed = [];

	const umzug = new Umzug({
		storage: memoryStorage(),
		migrations: migrationsList([
			{
				name: '00-first-migration',
				async up(): Promise<void> {
					executed.push('00-first-migration-up');
				},
				async down(): Promise<void> {
					executed.push('00-first-migration-down');
				},
			},
			{
				name: '01-second-migration',
				async up(): Promise<void> {
					executed.push('01-second-migration-up');
				},
				async down(): Promise<void> {
					executed.push('01-second-migration-down');
				},
			},
		]),
		migrationSorting: (a, b) => b.localeCompare(a),
	});
	const names = (migrations: Migration[]) => migrations.map(m => m.file);

	// Before anything
	expect(executed).toEqual([]);
	expect(names(await umzug.executed())).toEqual([]);
	expect(names(await umzug.pending())).toEqual(['01-second-migration', '00-first-migration']);

	// Up: all at once
	expect(names(await umzug.up())).toEqual(['01-second-migration', '00-first-migration']);
	expect(executed).toEqual(['01-second-migration-up', '00-first-migration-up']);
	expect(names(await umzug.executed())).toEqual(['01-second-migration', '00-first-migration']);
	expect(names(await umzug.pending())).toEqual([]);

	// Down: one by one
	expect(names(await umzug.down())).toEqual(['00-first-migration']);
	expect(executed).toEqual(['01-second-migration-up', '00-first-migration-up', '00-first-migration-down']);
	expect(names(await umzug.executed())).toEqual(['01-second-migration']);
	expect(names(await umzug.pending())).toEqual(['00-first-migration']);

	expect(names(await umzug.down())).toEqual(['01-second-migration']);
	expect(executed).toEqual([
		'01-second-migration-up',
		'00-first-migration-up',
		'00-first-migration-down',
		'01-second-migration-down',
	]);
	expect(names(await umzug.executed())).toEqual([]);
	expect(names(await umzug.pending())).toEqual(['01-second-migration', '00-first-migration']);
});

test('to', async () => {
	const noop = async () => {};
	const umzug = new Umzug({
		storage: memoryStorage(),
		migrations: migrationsList([
			{ name: 'm1', up: noop, down: noop },
			{ name: 'm2', up: noop, down: noop },
			{ name: 'm3', up: noop, down: noop },
			{ name: 'm4', up: noop, down: noop },
			{ name: 'm5', up: noop, down: noop },
			{ name: 'm6', up: noop, down: noop },
			{ name: 'm7', up: noop, down: noop },
		]),
	});

	await umzug.up();

	const names = (migrations: Migration[]) => migrations.map(m => m.file);

	expect(names(await umzug.executed())).toEqual(['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7']);

	await umzug.down({});
	expect(names(await umzug.executed())).toEqual(['m1', 'm2', 'm3', 'm4', 'm5', 'm6']);

	await umzug.down({ to: undefined });
	expect(names(await umzug.executed())).toEqual(['m1', 'm2', 'm3', 'm4', 'm5']);

	await umzug.down({ to: 'm3' });
	expect(names(await umzug.executed())).toEqual(['m1', 'm2']);

	await umzug.down({ to: 0 });
	expect(names(await umzug.executed())).toEqual([]);
});

test('events', async () => {
	const mock = jest.fn();
	const spy = (label: string) => (...args) => mock(label, ...args);

	const umzug = new Umzug({
		storage: memoryStorage(),
		migrations: migrationsList([
			{ name: 'm1', up: spy('up-m1'), down: spy('down-m1') },
			{ name: 'm2', up: spy('up-m2'), down: spy('down-m2') },
		]),
	});

	// `.addListener` and `.on` are aliases - use both to make sure they're wired up properly
	umzug.addListener('migrating', spy('migrating'));
	umzug.on('migrated', spy('migrated'));

	const revertingSpy = spy('reverting');
	umzug.addListener('reverting', revertingSpy);
	umzug.on('reverted', spy('reverted'));

	await umzug.up();

	expect(mock.mock.calls).toMatchObject([
		['migrating', 'm1', { file: 'm1' }],
		['up-m1'],
		['migrated', 'm1', { file: 'm1' }],
		['migrating', 'm2', { file: 'm2' }],
		['up-m2'],
		['migrated', 'm2', { file: 'm2' }],
	]);

	mock.mockClear();

	await umzug.down();

	expect(mock.mock.calls).toMatchObject([
		['reverting', 'm2', { file: 'm2' }],
		['down-m2'],
		['reverted', 'm2', { file: 'm2' }],
	]);

	mock.mockClear();

	umzug.removeListener('reverting', revertingSpy);

	await umzug.down();

	expect(mock.mock.calls).toMatchObject([
		// `reverting` shouldn't be here because the listener was removed
		['down-m1'],
		['reverted', 'm1', { file: 'm1' }],
	]);
});

test('validates logging function', () => {
	// @ts-expect-error
	expect(() => new Umzug({ logging: 1 })).toThrowErrorMatchingInlineSnapshot(
		`"The logging-option should be either a function or false"`
	);
});
