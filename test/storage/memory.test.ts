import { expectTypeOf } from 'expect-type';
import { UmzugStorage, memoryStorage } from '../../src';
import {describe, test, expect} from 'vitest'

describe('memoryStorage', () => {
	test('type', () => {
		expectTypeOf(memoryStorage).returns.toMatchTypeOf<UmzugStorage>();
		// no additional properties:
		expectTypeOf(memoryStorage).returns.toEqualTypeOf<UmzugStorage>();
	});

	test('executed returns empty array when no migrations are logged', async () => {
		const storage = memoryStorage();
		expect(await storage.executed({ context: {} })).toEqual([]);
	});

	test('logMigration, executed and unlogMigration', async () => {
		const storage = memoryStorage();

		await storage.logMigration({ name: 'm1', context: {} });
		expect(await storage.executed({ context: {} })).toEqual(['m1']);

		await storage.logMigration({ name: 'm1', context: {} });
		await storage.logMigration({ name: 'm2', context: {} });
		expect(await storage.executed({ context: {} })).toEqual(['m1', 'm1', 'm2']);

		await storage.unlogMigration({ name: 'm1', context: {} });
		expect(await storage.executed({ context: {} })).toEqual(['m2']);

		await storage.unlogMigration({ name: 'm2', context: {} });
		expect(await storage.executed({ context: {} })).toEqual([]);
	});

	test(`executed isn't affected by side-effects`, async () => {
		const storage = memoryStorage();

		const executed = await storage.executed({ context: {} });
		executed.push('abc');

		expect(await storage.executed({ context: {} })).toEqual([]);
	});
});
