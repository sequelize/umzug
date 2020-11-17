import { fsSyncer } from 'fs-syncer';
import { UmzugCLI } from '../src/cli';
import * as path from 'path';
import * as fs from 'fs';
import { Umzug } from '../src';
import * as del from 'del';

describe('cli from instance', () => {
	jest.spyOn(console, 'log').mockImplementation(() => {});

	const syncer = fsSyncer(path.join(__dirname, 'generated/cli/from-instance'), {
		'umzug.js': `
      const { Umzug, JSONStorage } = require(${JSON.stringify(require.resolve('../src'))})

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
			await new UmzugCLI('test', () => umzug).executeWithoutErrorHandling(argv);
			return (await umzug.executed()).map(e => e.name);
		};

		await expect(runCli(['up'])).resolves.toEqual(['m1.js', 'm2.js', 'm3.js']);
		await expect(runCli(['down'])).resolves.toEqual(['m1.js', 'm2.js']);
		await expect(runCli(['down', '--to', '0'])).resolves.toEqual([]);
		await expect(runCli(['up', '--to', 'm2.js'])).resolves.toEqual(['m1.js', 'm2.js']);

		await expect(runCli(['down', '--to', '0'])).resolves.toEqual([]);

		await expect(runCli(['up', '--migration', 'm1.js', '--to', 'm2.js'])).rejects.toThrowError(
			/Can't specify 'to' and 'migrations' together/
		);

		await expect(runCli(['up', '--migration', 'm1.js', '--migration', 'm3.js'])).resolves.toEqual(['m1.js', 'm3.js']);

		await expect(runCli(['down', '--migration', 'm1.js'])).resolves.toEqual(['m3.js']);

		await expect(runCli(['up', '--migration', 'm3.js'])).rejects.toThrowError(
			/Couldn't find migration to apply with name "m3.js"/
		);

		await expect(runCli(['up', '--rerun', 'ALLOW'])).rejects.toThrowError(/Can't specify 'rerun' without 'migrations'/);

		await expect(runCli(['up', '--migration', 'm3.js', '--rerun', 'THROW'])).rejects.toThrowError(
			/Couldn't find migration to apply with name "m3.js"/
		);

		await expect(runCli(['up', '--migration', 'm3.js', '--rerun', 'ALLOW'])).resolves.toEqual(['m3.js']);
	});
});

describe('run as cli', () => {
	jest.spyOn(console, 'log').mockImplementation(() => {});

	const syncer = fsSyncer(path.join(__dirname, 'generated/cli/run-as-cli'), {
		'umzug.js': `
      const { Umzug, JSONStorage } = require(${JSON.stringify(require.resolve('../src'))})

      const umzug = new Umzug({
				migrations: { glob: ['migrations/*.js', { cwd: __dirname }] },
				storage: new JSONStorage({path: __dirname + '/storage.json'}),
			})
			
			exports.run = () => umzug.runAsCLI(['up'])
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
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		await require(uzmugPath).run();
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		expect(require(path.join(syncer.baseDir, 'storage.json'))).toEqual(['m1.js', 'm2.js', 'm3.js']);
	});
});

describe('list migrations', () => {
	const mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});

	const syncer = fsSyncer(path.join(__dirname, 'generated/cli/list'), {
		'umzug.js': `
      const { Umzug, JSONStorage } = require(${JSON.stringify(require.resolve('../src'))})

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

	test('run as cli', async () => {
		/** clear console log calls, run the cli, then return new console log calls */
		const runCLI = async (argv: string[]) => {
			mockLog.mockClear();
			await umzug.runAsCLI(argv);
			const [logs] = mockLog.mock.calls;
			return logs[0].map((log: any) => ({ name: log.name, path: '...' }));
		};

		await expect(runCLI(['pending'])).resolves.toMatchInlineSnapshot(`
					Array [
					  Object {
					    "name": "m1.js",
					    "path": "...",
					  },
					  Object {
					    "name": "m2.js",
					    "path": "...",
					  },
					  Object {
					    "name": "m3.js",
					    "path": "...",
					  },
					]
				`);
		await expect(runCLI(['executed'])).resolves.toMatchInlineSnapshot(`Array []`);

		await umzug.up();

		await expect(runCLI(['pending'])).resolves.toMatchInlineSnapshot(`Array []`);
		await expect(runCLI(['executed'])).resolves.toMatchInlineSnapshot(`
					Array [
					  Object {
					    "name": "m1.js",
					    "path": "...",
					  },
					  Object {
					    "name": "m2.js",
					    "path": "...",
					  },
					  Object {
					    "name": "m3.js",
					    "path": "...",
					  },
					]
				`);
	});
});

describe('create migration file', () => {
	jest.spyOn(console, 'log').mockImplementation(() => {});

	// prettier-ignore
	beforeAll(() => {
		const dates = [...new Array(100)].map((_, i) => new Date(new Date('2000').getTime() + (1000 * 60 * 60 * 24 * i)).toISOString());
		jest.spyOn(Date.prototype, 'toISOString').mockImplementation(() => dates.shift()!);
	});

	const syncer = fsSyncer(path.join(__dirname, 'generated/cli/create'), {
		'umzug.js': `
      const { Umzug, JSONStorage } = require(${JSON.stringify(require.resolve('../src'))})

      exports.default = new Umzug({
				migrations: { glob: ['migrations/*.js', { cwd: __dirname }] },
				storage: new JSONStorage({path: __dirname + '/storage.json'}),
      })
		`,
		'template.js': `exports.default = filepath => [[filepath, 'custom migration']]`,
		'bad-template.js': `exports.default = filepath => [filepath, 'blah']`, // should be an array of pairs, not just a pair
		'storage.json': '[]',
		migrations: {},
	});
	syncer.sync();
	del.sync(path.join(syncer.baseDir, 'migrations/down'));

	const uzmugPath = path.join(syncer.baseDir, 'umzug.js');
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const umzug: Umzug<{}> = require(uzmugPath).default;

	test('create', async () => {
		/** run the cli with the specified args, then return the *new* migration files on disk */
		const runCLI = async (argv: string[]) => {
			const migrationsBefore = (syncer.read() as Record<string, any>).migrations;

			await new UmzugCLI('test', () => umzug).executeWithoutErrorHandling(argv);
			const migrationsAfter = (syncer.read() as Record<string, any>).migrations;
			// eslint-disable-next-line @typescript-eslint/no-dynamic-delete
			Object.keys(migrationsBefore || {}).forEach(k => delete migrationsAfter[k]);
			return migrationsAfter;
		};

		await expect(runCLI(['create', '--name', 'm1.js'])).rejects.toThrowErrorMatchingInlineSnapshot(
			`"Couldn't infer a folder to generate migration file in. Pass '--folder path/to/folder' explicitly"`
		);

		// a folder must be specified for the first migration
		await expect(runCLI(['create', '--name', 'm1.js', '--folder', path.join(syncer.baseDir, 'migrations')])).resolves
			.toMatchInlineSnapshot(`
					Object {
					  "2000.01.02T00.00.00.m1.js": "exports.up = params => {};
					exports.down = params => {};
					",
					}
				`);

		// for the second migration, the program should guess it's supposed to live next to the previous one.
		await expect(runCLI(['create', '--name', 'm2.ts'])).resolves.toMatchInlineSnapshot(`
					Object {
					  "2000.01.03T00.00.00.m2.ts": "export const up = params => {};
					export const down = params => {};
					",
					}
				`);

		expect(fs.existsSync(path.join(syncer.baseDir, 'migrations/down'))).toBe(false);
		await expect(runCLI(['create', '--name', 'm3.sql'])).resolves.toMatchInlineSnapshot(`
					Object {
					  "2000.01.04T00.00.00.m3.sql": "-- up migration",
					  "down": Object {
					    "2000.01.04T00.00.00.m3.sql": "-- down migration",
					  },
					}
				`);

		await expect(runCLI(['create', '--name', 'm4.txt'])).resolves.toMatchInlineSnapshot(`
					Object {
					  "2000.01.05T00.00.00.m4.txt": "",
					}
				`);

		await expect(runCLI(['create', '--name', 'm5.js', '--prefix', 'DATE'])).resolves.toMatchInlineSnapshot(`
					Object {
					  "2000.01.06.m5.js": "exports.up = params => {};
					exports.down = params => {};
					",
					}
				`);

		// this will fail because we're creating ".m6.js" with no prefix. This results in an unexpected alphabetical order.
		await expect(runCLI(['create', '--name', '.m6.js', '--prefix', 'NONE'])).rejects.toThrowErrorMatchingInlineSnapshot(
			`"Can't create .m6.js, since it might run before existing migration 2000.01.02T00.00.00.m1.js"`
		);

		// Explicitly allow the weird alphabetical ordering.
		await expect(runCLI(['create', '--name', '.m6.js', '--prefix', 'NONE', '--allow-confusing-ordering'])).resolves
			.toMatchInlineSnapshot(`
					Object {
					  ".m6.js": "exports.up = params => {};
					exports.down = params => {};
					",
					}
				`);

		await expect(runCLI(['create', '--name', 'm7.txt', '--template', path.join(syncer.baseDir, 'template.js')]))
			.resolves.toMatchInlineSnapshot(`
					Object {
					  "2000.01.09T00.00.00.m7.txt": "custom migration",
					}
				`);

		await expect(
			runCLI(['create', '--name', 'm8.txt', '--template', path.join(syncer.baseDir, 'bad-template.js')])
		).rejects.toThrowErrorMatchingInlineSnapshot(`"Expected [filepath, content] pair."`);
	});
});
