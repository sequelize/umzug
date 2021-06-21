import path = require('path');
import { expectTypeOf } from 'expect-type';
import { fsSyncer } from 'fs-syncer';

import { TXTStorage, UmzugStorage } from '../../src';

describe('TXTStorage', () => {
	describe('constructor', () => {
		test('type', () => {
			expectTypeOf(TXTStorage).toBeConstructibleWith();
			expectTypeOf(TXTStorage).toBeConstructibleWith({});
			expectTypeOf(TXTStorage).toBeConstructibleWith({ path: 'test.txt' });
			expectTypeOf(TXTStorage).instance.toMatchTypeOf<UmzugStorage>();
			expectTypeOf(TXTStorage).instance.toHaveProperty('path').toBeString();
		});

		test('default storage path', () => {
			const storage = new TXTStorage();
			expect(storage.path).toEqual(path.join(process.cwd(), 'umzug.txt'));
		});
	});

	describe('logMigration', () => {
		const syncer = fsSyncer(path.join(__dirname, '../generated/TXTStorage/logMigration'), {});
		const storage = new TXTStorage({ path: path.join(syncer.baseDir, 'umzug.txt') });

		beforeEach(syncer.sync);

		test('adds entry', async () => {
			await storage.logMigration({ name: 'seed-1.js' });

			expect(syncer.read()).toEqual({
				'umzug.txt': 'seed-1.js\n',
			});
		});

		test(`doesn't dedupe`, async () => {
			await storage.logMigration({ name: 'seed-1.js' });
			await storage.logMigration({ name: 'seed-1.js' });

			expect(syncer.read()).toEqual({
				'umzug.txt': 'seed-1.js\nseed-1.js\n',
			});
		});
	});

	describe('unlogMigration', () => {
		const syncer = fsSyncer(path.join(__dirname, '../generated/TXTStorage/unlogMigration'), {
			'umzug.txt': 'seed-1.js\nseed-2.js\n',
		});
		const storage = new TXTStorage({ path: path.join(syncer.baseDir, 'umzug.txt') });

		beforeEach(syncer.sync);

		test('removes entry', async () => {
			await storage.unlogMigration({ name: 'seed-1.js' });

			expect(syncer.read()).toEqual({
				'umzug.txt': 'seed-2.js\n',
			});
		});

		test(`it does nothing when unlogging non-existent migration`, async () => {
			await storage.unlogMigration({ name: 'does-not-exists.js' });

			expect(syncer.read()).toEqual({
				'umzug.txt': 'seed-1.js\nseed-2.js\n',
			});
		});
	});

	describe('executed', () => {
		const syncer = fsSyncer(path.join(__dirname, '../generated/TXTStorage/executed'), {});
		const storage = new TXTStorage({ path: path.join(syncer.baseDir, 'umzug.txt') });

		beforeEach(syncer.sync);

		test('returns empty array when no migrations are logged', async () => {
			const executed = await storage.executed();

			expect(executed).toEqual([]);
		});

		test('returns logged migration', async () => {
			await storage.logMigration({ name: 'seed-1.js' });
			const executed = await storage.executed();

			expect(executed).toEqual(['seed-1.js']);
		});
	});
});
