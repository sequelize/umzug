import { expectTypeOf } from 'expect-type';
import { JSONStorage } from '../../src/storages/JSONStorage';
import { fsSyncer } from 'fs-syncer';
import * as path from 'path';
import * as dedent from 'dedent';
import { UmzugStorage } from '../../src/storages/type-helpers/umzug-storage';

describe('JSONStorage', () => {
	describe('constructor', () => {
		test('type', () => {
			expectTypeOf(JSONStorage).toBeConstructibleWith();
			expectTypeOf(JSONStorage).toBeConstructibleWith({});
			expectTypeOf(JSONStorage).toBeConstructibleWith({ path: 'abc' });

			expectTypeOf(JSONStorage).instance.toMatchTypeOf<UmzugStorage>();
			expectTypeOf(JSONStorage).instance.toHaveProperty('path').toBeString();
		});

		test('default storage path', () => {
			const storage = new JSONStorage();
			expect(storage.path).toEqual(path.join(process.cwd(), 'umzug.json'));
		});
	});

	describe('logMigration', () => {
		const syncer = fsSyncer(path.join(__dirname, '../generated/JSONStorage/logMigration'), {});
		beforeEach(syncer.sync); // Wipes out the directory
		const storage = new JSONStorage({ path: path.join(syncer.baseDir, 'umzug.json') });

		test('adds entry', async () => {
			await storage.logMigration('m1.txt');
			expect(syncer.read()).toEqual({
				'umzug.json': dedent`[
          "m1.txt"
        ]`,
			});
		});
		test(`doesn't dedupe`, async () => {
			await storage.logMigration('m1.txt');
			await storage.logMigration('m1.txt');
			expect(syncer.read()).toEqual({
				'umzug.json': dedent`[
          "m1.txt",
          "m1.txt"
        ]`,
			});
		});
	});

	describe('unlogMigration', () => {
		const syncer = fsSyncer(path.join(__dirname, '../generated/JSONStorage/unlogMigration'), {
			'umzug.json': `["m1.txt"]`,
		});
		beforeEach(syncer.sync); // Wipes out the directory
		const storage = new JSONStorage({ path: path.join(syncer.baseDir, 'umzug.json') });

		test('removes entry', async () => {
			await storage.unlogMigration('m1.txt');
			expect(syncer.read()).toEqual({
				'umzug.json': '[]',
			});
		});

		test('does nothing when unlogging non-existent migration', async () => {
			await storage.unlogMigration('does-not-exist.txt');
			expect(syncer.read()).toEqual({
				'umzug.json': dedent`[
          "m1.txt"
        ]`,
			});
		});
	});

	describe('executed', () => {
		const syncer = fsSyncer(path.join(__dirname, '../generated/JSONStorage/unlogMigration'), {});
		beforeEach(syncer.sync); // Wipes out the directory
		const storage = new JSONStorage({ path: path.join(syncer.baseDir, 'umzug.json') });

		test('returns empty array when no migrations are logged', async () => {
			expect(await storage.executed()).toEqual([]);
		});

		test('returns logged migration', async () => {
			await storage.logMigration('m1.txt');
			expect(await storage.executed()).toEqual(['m1.txt']);
		});
	});
});
