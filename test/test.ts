import test from 'ava';
import jetpack = require('fs-jetpack');
import { Umzug, Migration, migrationsList } from '../src';

test('migrations list', async t => {
	let executed = [];

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
		)
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
	t.deepEqual(executed, ['00-first-migration-up', '01-second-migration-up', '01-second-migration-down', '00-first-migration-down']);
	t.deepEqual(names(await umzug.executed()), []);
	t.deepEqual(names(await umzug.pending()), ['00-first-migration', '01-second-migration']);

	await jetpack.removeAsync('umzug.json');
});
