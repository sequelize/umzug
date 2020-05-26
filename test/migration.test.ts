import { Migration, MigrationConstructorOptions } from '../src/migration';
import { expectTypeOf } from 'expect-type';

describe('migration class', () => {
	test('type', () => {
		expectTypeOf(Migration).toBeConstructibleWith('m1');
		expectTypeOf(Migration).toBeConstructibleWith('m1', {} as MigrationConstructorOptions);
		expectTypeOf(Migration).toBeConstructibleWith('m1', {
			migrations: {
				customResolver: path => {
					expectTypeOf(path).toBeString();
					return { up: Promise.resolve, down: Promise.resolve };
				},
				nameFormatter: path => {
					expectTypeOf(path).toBeString();
					return path;
				},
				wrap: fn => {
					expectTypeOf(fn).toBeFunction();
					expectTypeOf(fn).returns.resolves.toBeAny();
					return fn;
				},
			},
		});
	});

	test('validates file is string', () => {
		expect(
			() =>
				new Migration('m1', {
					migrations: {
						// @ts-expect-error (nameFormatter should return string)
						nameFormatter: () => 123,
					},
				})
		).toThrowError(/Unexpected migration formatter result for '.*m1': expected string, got number/);
	});

	test('throws when resolving null migration', async () => {
		const migration = new Migration('m1', {
			migrations: {
				customResolver: () => null,
			},
		});

		await expect(migration.migration()).rejects.toThrowError(/Failed to obtain migration definition module for '.*m1'/);
	});

	test(`uses default export if up and down named exports don't exist`, async () => {
		const resolved = { up: jest.fn(), down: jest.fn() };
		const migration = new Migration('m1', {
			migrations: {
				customResolver: (): any => ({ default: resolved }),
			},
		});
		const definition = await migration.migration();

		expect(definition).toEqual(resolved);
	});
});
