import { Umzug, Migration, migrationsList, memoryStorage } from '../src';
import pkgDir = require('pkg-dir');

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
