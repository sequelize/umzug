import { expectTypeOf } from 'expect-type';
import { NoneStorage } from '../../src/storages/NoneStorage';
import { UmzugStorage } from '../../src/storages/type-helpers/umzug-storage';

describe('NoneStorage', () => {
	test('stores no options', () => {
		const storage = new NoneStorage();
		expect(storage).not.toHaveProperty('options');
	});

	test('type', () => {
		expectTypeOf(NoneStorage).instance.not.toHaveProperty('options');
		expectTypeOf(NoneStorage).instance.toMatchTypeOf<UmzugStorage>();
		expectTypeOf(NoneStorage).constructorParameters.toEqualTypeOf<[]>();
	});

	test('exectued returns empty array', async () => {
		const storage = new NoneStorage();
		expect(await storage.executed()).toEqual([]);
	});

	test('exectued returns empty array even if migrations were logged', async () => {
		const storage = new NoneStorage();
		await storage.logMigration('foo.js');
		expect(await storage.executed()).toEqual([]);
	});
});
