import { fsSyncer } from 'fs-syncer';
import { UmzugCLI } from '../src/cli';
import * as fs from 'fs';
import * as path from 'path';
import * as childProcess from 'child_process';
import { Umzug } from '../src';
import del from 'del';
import { expectTypeOf } from 'expect-type';
import { vi as jest, describe, test, expect, beforeEach, beforeAll } from 'vitest';

beforeAll(() => {
	childProcess.execSync('npm run build', { cwd: path.resolve(__dirname, '..') });
});

describe('cli from instance', () => {
	jest.spyOn(console, 'log').mockImplementation(() => {});

	const syncer = fsSyncer(path.join(__dirname, 'generated/cli/from-instance'), {
		'umzug.js': `
      const { Umzug, JSONStorage } = require(${JSON.stringify(path.resolve(__dirname, '../lib'))})

      exports.default = new Umzug({
				migrations: { glob: ['migrations/*.js', { cwd: __dirname }] },
				storage: new JSONStorage({path: __dirname + '/storage.json'}),
      })
    `,
		'storage.json': '[]',
		migrations: {
			'm1.js': `exports.up = exports.down = async params => console.log(params)`,
			'm2.js': `exports.up = exports.down = async params => console.log(params)`,
			'm3.js': `exports.up = exports.down = async params => console.log(params)`,
		},
	});
	syncer.sync();

	const uzmugPath = path.join(syncer.baseDir, 'umzug.js');
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const umzug: Umzug<{}> = require(uzmugPath).default;

	test('cli', async () => {
		/** run the cli with the specified args, then return the executed migration names */
		const runCli = async (argv: string[]) => {
			await new UmzugCLI(umzug).executeWithoutErrorHandling(argv);
			return (await umzug.executed()).map(e => e.name);
		};

		await expect(runCli(['up'])).resolves.toEqual(['m1.js', 'm2.js', 'm3.js']);
		await expect(runCli(['down'])).resolves.toEqual(['m1.js', 'm2.js']);
		await expect(runCli(['down', '--to', '0'])).resolves.toEqual([]);
		await expect(runCli(['up', '--to', 'm2.js'])).resolves.toEqual(['m1.js', 'm2.js']);

		await expect(runCli(['down', '--to', '0'])).resolves.toEqual([]);

		await expect(runCli(['up', '--step', '2'])).resolves.toEqual(['m1.js', 'm2.js']);

		await expect(runCli(['down', '--step', '2'])).resolves.toEqual([]);

		await expect(runCli(['up', '--name', 'm1.js', '--to', 'm2.js'])).rejects.toThrow(
			/Can't specify 'to' and 'name' together/
		);

		await expect(runCli(['up', '--to', 'm2.js', '--step', '2'])).rejects.toThrow(
			/Can't specify 'to' and 'step' together/
		);

		await expect(runCli(['up', '--step', '2', '--name', 'm1.js'])).rejects.toThrow(
			/Can't specify 'step' and 'name' together/
		);

		await expect(runCli(['up', '--name', 'm1.js', '--name', 'm3.js'])).resolves.toEqual(['m1.js', 'm3.js']);

		await expect(runCli(['down', '--name', 'm1.js'])).resolves.toEqual(['m3.js']);

		await expect(runCli(['up', '--name', 'm3.js'])).rejects.toThrow(
			/Couldn't find migration to apply with name "m3.js"/
		);

		await expect(runCli(['up', '--rerun', 'ALLOW'])).rejects.toThrow(/Can't specify 'rerun' without 'name'/);

		await expect(runCli(['up', '--name', 'm3.js', '--rerun', 'THROW'])).rejects.toThrow(
			/Couldn't find migration to apply with name "m3.js"/
		);

		await expect(runCli(['up', '--name', 'm3.js', '--rerun', 'ALLOW'])).resolves.toEqual(['m3.js']);
	});
});

describe('run as cli', () => {
	jest.spyOn(console, 'log').mockImplementation(() => {});

	const syncer = fsSyncer(path.join(__dirname, 'generated/cli/run-as-cli'), {
		'umzug.js': `
      const { Umzug, JSONStorage } = require(${JSON.stringify(path.resolve(__dirname, '..'))})

      const umzug = new Umzug({
				migrations: { glob: ['migrations/*.js', { cwd: __dirname }] },
				storage: new JSONStorage({path: __dirname + '/storage.json'}),
			})
			
			if (require.main === module) {
				umzug.runAsCLI()
			}
    `,
		'notumzug.js': `exports.default = 1234`,
		'storage.json': '[]',
		migrations: {
			'm1.js': `exports.up = exports.down = async params => console.log(params)`,
			'm2.js': `exports.up = exports.down = async params => console.log(params)`,
			'm3.js': `exports.up = exports.down = async params => console.log(params)`,
		},
	});
	syncer.sync();

	const uzmugPath = path.join(syncer.baseDir, 'umzug.js');

	test('run as cli', async () => {
		// note: this test requires the library to have been built since it's spawning a sub-process which doesn't transform typescript via jest.
		childProcess.execSync(['node', uzmugPath, 'up'].join(' '));
		// await require(uzmugPath).run();
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		expect(require(path.join(syncer.baseDir, 'storage.json'))).toEqual(['m1.js', 'm2.js', 'm3.js']);
	});
});

describe('list migrations', () => {
	test('pending and executed', async () => {
		const mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});

		const syncer = fsSyncer(path.join(__dirname, 'generated/cli/list'), {
			'umzug.js': `
				const { Umzug, JSONStorage } = require(${JSON.stringify(path.resolve(__dirname, '../lib'))})

				exports.default = new Umzug({
					migrations: { glob: ['migrations/*.js', { cwd: __dirname }] },
					storage: new JSONStorage({path: __dirname + '/storage.json'}),
				})
		`,
			'notumzug.js': `exports.default = 1234`,
			'storage.json': '[]',
			migrations: {
				'm1.js': `exports.up = exports.down = async () => {}`,
				'm2.js': `exports.up = exports.down = async () => {}`,
				'm3.js': `exports.up = exports.down = async () => {}`,
			},
		});
		syncer.sync();

		const uzmugPath = path.join(syncer.baseDir, 'umzug.js');
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const umzug: Umzug<{}> = require(uzmugPath).default;
		/** clear console log calls, run the cli, then return new console log calls */
		const runCLI = async (argv: string[]) => {
			mockLog.mockClear();
			await umzug.runAsCLI(argv);
			// json output includes full paths, which might use windows separators. get rid of cwd and normalise separators.
			return mockLog.mock.calls[0]?.[0]
				?.split(JSON.stringify(process.cwd()).slice(1, -1))
				.join('<cwd>')
				.split(JSON.stringify('\\').slice(1, -1))
				.join('/');
		};

		await expect(runCLI(['pending'])).resolves.toMatchInlineSnapshot(`
					"m1.js
					m2.js
					m3.js"
				`);
		await expect(runCLI(['executed'])).resolves.toMatchInlineSnapshot(`""`);

		await umzug.up();

		await expect(runCLI(['pending'])).resolves.toMatchInlineSnapshot(`""`);
		await expect(runCLI(['executed'])).resolves.toMatchInlineSnapshot(`
					"m1.js
					m2.js
					m3.js"
				`);
		await expect(runCLI(['executed', '--json'])).resolves.toMatchInlineSnapshot(`
			"[
			  {
			    \\"name\\": \\"m1.js\\",
			    \\"path\\": \\"<cwd>/test/generated/cli/list/migrations/m1.js\\"
			  },
			  {
			    \\"name\\": \\"m2.js\\",
			    \\"path\\": \\"<cwd>/test/generated/cli/list/migrations/m2.js\\"
			  },
			  {
			    \\"name\\": \\"m3.js\\",
			    \\"path\\": \\"<cwd>/test/generated/cli/list/migrations/m3.js\\"
			  }
			]"
		`);
	});
});

describe('create migration file', () => {
	jest.spyOn(console, 'log').mockImplementation(() => {});

	// prettier-ignore
	beforeEach(() => {
		const dates = [...Array.from({length: 100})].map((_, i) => new Date(new Date('2000').getTime() + (1000 * 60 * 60 * 24 * i)).toISOString());
		jest.spyOn(Date.prototype, 'toISOString').mockImplementation(() => dates.shift()!);
	});

	test('create', async () => {
		const syncer = fsSyncer(path.join(__dirname, 'generated/cli/create'), {
			'umzug.js': `
				const { Umzug, JSONStorage } = require(${JSON.stringify(path.resolve(__dirname, '../lib'))})
	
				exports.default = new Umzug({
					migrations: {
						glob: ['migrations/*.{js,ts,cjs,mjs,sql}', { cwd: __dirname }],
						resolve: params => ({ ...params, up: async () => {}, down: async () => {} }),
					},
					storage: new JSONStorage({path: __dirname + '/storage.json'}),
				})
			`,
			'storage.json': '[]',
			migrations: {},
		});
		syncer.sync();
		del.sync(path.join(syncer.baseDir, 'migrations/'));

		const uzmugPath = path.join(syncer.baseDir, 'umzug.js');
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const umzug: Umzug<{}> = require(uzmugPath).default;

		/** run the cli with the specified args, then return the *new* migration files on disk */
		const runCLI = async (argv: string[]) => {
			const migrationsBefore = (syncer.read() as Record<string, any>).migrations;

			await new UmzugCLI(umzug).executeWithoutErrorHandling(argv);
			const migrationsAfter = (syncer.read() as Record<string, any>).migrations;
			// eslint-disable-next-line @typescript-eslint/no-dynamic-delete
			Object.keys(migrationsBefore || {}).forEach(k => delete migrationsAfter[k]);
			return migrationsAfter;
		};

		await expect(runCLI(['create', '--name', 'm1.js'])).rejects.toThrowErrorMatchingInlineSnapshot(
			`"Couldn't infer a directory to generate migration file in. Pass --folder explicitly"`
		);

		// a folder must be specified for the first migration
		await expect(runCLI(['create', '--name', 'm1.js', '--folder', path.join(syncer.baseDir, 'migrations')])).resolves
			.toMatchInlineSnapshot(`
		{
		  "2000.01.02T00.00.00.m1.js": "/** @type {import('umzug').MigrationFn<any>} */
		exports.up = async params => {};

		/** @type {import('umzug').MigrationFn<any>} */
		exports.down = async params => {};
		",
		}
	`);

		// for the second migration, the program should guess it's supposed to live next to the previous one.
		await expect(runCLI(['create', '--name', 'm2.ts'])).resolves.toMatchInlineSnapshot(`
		{
		  "2000.01.03T00.00.00.m2.ts": "import type { MigrationFn } from 'umzug';

		export const up: MigrationFn = async params => {};
		export const down: MigrationFn = async params => {};
		",
		}
	`);

		expect(fs.existsSync(path.join(syncer.baseDir, 'migrations/down'))).toBe(false);
		await expect(runCLI(['create', '--name', 'm3.sql'])).resolves.toMatchInlineSnapshot(`
		{
		  "2000.01.04T00.00.00.m3.sql": "-- up migration
		",
		  "down": {
		    "2000.01.04T00.00.00.m3.sql": "-- down migration
		",
		  },
		}
	`);

		await expect(runCLI(['create', '--name', 'm4.txt'])).rejects.toThrowErrorMatchingInlineSnapshot(
			`"Extension .txt not allowed. Allowed extensions are .js, .cjs, .mjs, .ts, .sql. See help for --allow-extension to avoid this error."`
		);

		await expect(runCLI(['create', '--name', 'm4.txt', '--allow-extension', '.txt'])).rejects.toThrow(
			/Expected .*2000.01.06T00.00.00.m4.txt to be a pending migration but it wasn't! Pending migration paths: (.*). You should investigate this./
		);

		await expect(runCLI(['create', '--name', 'm4.txt', '--allow-extension', '.txt', '--skip-verify'])).resolves
			.toMatchInlineSnapshot(`
		{
		  "2000.01.07T00.00.00.m4.txt": "",
		}
	`);

		await expect(runCLI(['create', '--name', 'm5.cjs', '--prefix', 'DATE'])).resolves.toMatchInlineSnapshot(`
		{
		  "2000.01.08.m5.cjs": "/** @type {import('umzug').MigrationFn<any>} */
		exports.up = async params => {};

		/** @type {import('umzug').MigrationFn<any>} */
		exports.down = async params => {};
		",
		}
	`);

		// this will fail because we're creating "000.m6.js" with no prefix. This results in an unexpected alphabetical order.
		await expect(
			runCLI(['create', '--name', '000.m6.js', '--prefix', 'NONE'])
		).rejects.toThrowErrorMatchingInlineSnapshot(
			`"Can't create 000.m6.js, since it's unclear if it should run before or after existing migration 2000.01.02T00.00.00.m1.js. Use --allow-confusing-ordering to bypass this error."`
		);

		// Explicitly allow the weird alphabetical ordering.
		await expect(runCLI(['create', '--name', '000.m6.mjs', '--prefix', 'NONE', '--allow-confusing-ordering'])).resolves
			.toMatchInlineSnapshot(`
		{
		  "000.m6.mjs": "/** @type {import('umzug').MigrationFn<any>} */
		export const up = async params => {};

		/** @type {import('umzug').MigrationFn<any>} */
		export const down = async params => {};
		",
		}
	`);
	});

	test('create with custom template', async () => {
		const syncer = fsSyncer(path.join(__dirname, 'generated/cli/create-custom-template'), {
			'umzug.js': `
				const { Umzug, JSONStorage } = require(${JSON.stringify(path.resolve(__dirname, '../lib'))})
				const path = require('path')
	
				exports.default = new Umzug({
					migrations: {
						glob: ['migrations/*.{js,ts,sql}', { cwd: __dirname }],
						resolve: (params) => ({ ...params, up: async () => {}, down: async () => {} }),
					},
					storage: new JSONStorage({path: __dirname + '/storage.json'}),
					create: {
						template: filepath => {
							const downpath = path.join(path.dirname(filepath), 'down', path.basename(filepath))
							return [
								[filepath, '-- custom up template'],
								[downpath, '-- custom down template']
							]
						}
					}
				})
			`,
			'storage.json': '[]',
			migrations: {},
		});
		syncer.sync();
		del.sync(path.join(syncer.baseDir, 'migrations/'));

		const uzmugPath = path.join(syncer.baseDir, 'umzug.js');
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const umzug: Umzug<{}> = require(uzmugPath).default;

		/** run the cli with the specified args, then return the *new* migration files on disk */
		const runCLI = async (argv: string[]) => {
			const migrationsBefore = (syncer.read() as Record<string, any>).migrations;

			await new UmzugCLI(umzug).executeWithoutErrorHandling(argv);
			const migrationsAfter = (syncer.read() as Record<string, any>).migrations;
			// eslint-disable-next-line @typescript-eslint/no-dynamic-delete
			Object.keys(migrationsBefore || {}).forEach(k => delete migrationsAfter[k]);
			return migrationsAfter;
		};

		await expect(runCLI(['create', '--name', 'm1.sql', '--folder', path.join(syncer.baseDir, 'migrations')])).resolves
			.toMatchInlineSnapshot(`
		{
		  "2000.01.11T00.00.00.m1.sql": "-- custom up template",
		  "down": {
		    "2000.01.11T00.00.00.m1.sql": "-- custom down template",
		  },
		}
	`);
	});

	test('create with invalid custom template', async () => {
		const syncer = fsSyncer(path.join(__dirname, 'generated/cli/create-invalid-template'), {
			'umzug.js': `
				const { Umzug, JSONStorage } = require(${JSON.stringify(path.resolve(__dirname, '../lib'))})
				const path = require('path')
	
				exports.default = new Umzug({
					migrations: {
						glob: ['migrations/*.{js,ts,sql}', { cwd: __dirname }],
						resolve: (params) => ({ ...params, up: async () => {}, down: async () => {} }),
					},
					storage: new JSONStorage({path: __dirname + '/storage.json'}),
					create: {
						folder: path.join(__dirname, 'migrations'),
						template: filepath => {
							return [filepath, '-- custom up template'] // will fail: should be Array<[string, string]>, not [string, string]
						}
					}
				})
			`,
			'storage.json': '[]',
			migrations: {},
		});
		syncer.sync();
		del.sync(path.join(syncer.baseDir, 'migrations/'));

		const uzmugPath = path.join(syncer.baseDir, 'umzug.js');
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const umzug: Umzug<{}> = require(uzmugPath).default;

		/** run the cli with the specified args */
		const runCLI = async (argv: string[]) => {
			await new UmzugCLI(umzug).executeWithoutErrorHandling(argv);
		};

		await expect(runCLI(['create', '--name', 'm1.sql'])).rejects.toMatchInlineSnapshot(
			`[Error: Expected [filepath, content] pair. Check that the file template function returns an array of pairs.]`
		);
	});
});

describe('exported from package', () => {
	test('cli exported as namespace', () => {
		expectTypeOf<import('../src').UmzugCLI>().toEqualTypeOf<UmzugCLI>();
	});
});
