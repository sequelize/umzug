import test from 'ava';
import jetpack = require('fs-jetpack');
import { Umzug, Migration, migrationsList } from '../src';
import pkgDir = require('pkg-dir');

test('Compiles & exports correctly', async t => {
	const dir = await pkgDir(__dirname);

	let requiredJS;

	t.notThrows(() => {
		requiredJS = require(dir);
	});

	t.truthy(requiredJS.Umzug);
	t.truthy(requiredJS.Migration);
	t.truthy(requiredJS.migrationsList);
});

test('migrationsList() works', async t => {
	const executed = [];

	await jetpack.removeAsync('umzug.json');

	const umzug = new Umzug({
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
	t.deepEqual(executed, []);
	t.deepEqual(names(await umzug.executed()), []);
	t.deepEqual(names(await umzug.pending()), ['00-first-migration', '01-second-migration']);

	// Up: all at once
	t.deepEqual(names(await umzug.up()), ['00-first-migration', '01-second-migration']);
	t.deepEqual(executed, ['00-first-migration-up', '01-second-migration-up']);
	t.deepEqual(names(await umzug.executed()), ['00-first-migration', '01-second-migration']);
	t.deepEqual(names(await umzug.pending()), []);

	// Down: one by one
	t.deepEqual(names(await umzug.down()), ['01-second-migration']);
	t.deepEqual(executed, ['00-first-migration-up', '01-second-migration-up', '01-second-migration-down']);
	t.deepEqual(names(await umzug.executed()), ['00-first-migration']);
	t.deepEqual(names(await umzug.pending()), ['01-second-migration']);

	t.deepEqual(names(await umzug.down()), ['00-first-migration']);
	t.deepEqual(executed, [
		'00-first-migration-up',
		'01-second-migration-up',
		'01-second-migration-down',
		'00-first-migration-down',
	]);
	t.deepEqual(names(await umzug.executed()), []);
	t.deepEqual(names(await umzug.pending()), ['00-first-migration', '01-second-migration']);

	await jetpack.removeAsync('umzug.json');
});

test.serial('migration sort', async t => {
	const executed = [];

	await jetpack.removeAsync('umzug.json');

	const umzug = new Umzug({
		migrations: migrationsList(
			[
				{
					name: '00-first-migration',
					async up(): Promise<void> {
						executed.push('00-first-migration-up');
					},
					async down(): Promise<void> {
						executed.push('00-first-migration-down');
					}
				},
				{
					name: '01-second-migration',
					async up(): Promise<void> {
						executed.push('01-second-migration-up');
					},
					async down(): Promise<void> {
						executed.push('01-second-migration-down');
					}
				}
			]
		),
		migrationSorting: (a, b) => {
			if (a > b) {
				return -1;
			}

			if (a < b) {
				return 1;
			}

			return 0;
		}
	});
	const names = (migrations: Migration[]) => migrations.map(m => m.file);

	// Before anything
	t.deepEqual(executed, []);
	t.deepEqual(names(await umzug.executed()), []);
	t.deepEqual(names(await umzug.pending()), ['01-second-migration', '00-first-migration']);

	// Up: all at once
	t.deepEqual(names(await umzug.up()), ['01-second-migration', '00-first-migration']);
	t.deepEqual(executed, ['01-second-migration-up', '00-first-migration-up']);
	t.deepEqual(names(await umzug.executed()), ['01-second-migration', '00-first-migration']);
	t.deepEqual(names(await umzug.pending()), []);

	// Down: one by one
	t.deepEqual(names(await umzug.down()), ['00-first-migration']);
	t.deepEqual(executed, ['01-second-migration-up', '00-first-migration-up', '00-first-migration-down']);
	t.deepEqual(names(await umzug.executed()), ['01-second-migration']);
	t.deepEqual(names(await umzug.pending()), ['00-first-migration']);

	t.deepEqual(names(await umzug.down()), ['01-second-migration']);
	t.deepEqual(executed, ['01-second-migration-up', '00-first-migration-up', '00-first-migration-down', '01-second-migration-down']);
	t.deepEqual(names(await umzug.executed()), []);
	t.deepEqual(names(await umzug.pending()), ['01-second-migration', '00-first-migration']);

	await jetpack.removeAsync('umzug.json');
});
