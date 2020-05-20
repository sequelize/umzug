import { Umzug, Migration, migrationsList, memoryStorage } from '../src';
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

test('events', async () => {
	const mock = jest.fn();
	// eslint-disable-next-line @typescript-eslint/no-unsafe-return
	const spy = (label: string) => (...args) => mock([label, ...args]);

	const umzug = new Umzug({
		storage: memoryStorage(),
		migrations: migrationsList([
			{ name: 'm1', up: spy('up'), down: spy('down') },
			{ name: 'm2', up: spy('up'), down: spy('down') },
		]).map(m => {
			m.toString = () => `{migration: ${m.file}}`;
			return m;
		}),
	});
	umzug.addListener('migrating', spy('migrating'));
	umzug.on('migrated', spy('migrated'));
	umzug.on('reverting', spy('reverting'));
	umzug.on('reverted', spy('reverted'));

	await umzug.up();

	expect(mock.mock.calls.join('\n')).toMatchInlineSnapshot(`
		"migrating,m1,{migration: m1}
		up
		migrated,m1,{migration: m1}
		migrating,m2,{migration: m2}
		up
		migrated,m2,{migration: m2}"
	`);

	mock.mockClear();

	await umzug.down();

	expect(mock.mock.calls.join('\n')).toMatchInlineSnapshot(`
		"reverting,m2,{migration: m2}
		down
		reverted,m2,{migration: m2}"
	`);
});
