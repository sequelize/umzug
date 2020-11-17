import { fsSyncer } from 'fs-syncer';
import { UmzugCLI } from '../src/cli';
import * as path from 'path';
import * as fs from 'fs';
import * as childProcess from 'child_process';
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
      const { Umzug, JSONStorage } = require(${JSON.stringify(require.resolve('..'))})

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

	test('pending and executed', async () => {
		/** clear console log calls, run the cli, then return new console log calls */
		const runCLI = async (argv: string[]) => {
			mockLog.mockClear();
			await umzug.runAsCLI(argv);
			// json output includes full paths, which might use windows separators. get rid of cwd and normalise separators.
			return mockLog.mock.calls[0][0]
				.split(JSON.stringify(process.cwd()).slice(1, -1))
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
	beforeAll(() => {
		const dates = [...new Array(100)].map((_, i) => new Date(new Date('2000').getTime() + (1000 * 60 * 60 * 24 * i)).toISOString());
		jest.spyOn(Date.prototype, 'toISOString').mockImplementation(() => dates.shift()!);
	});

	const syncer = fsSyncer(path.join(__dirname, 'generated/cli/create'), {
		'umzug.js': `
      const { Umzug, JSONStorage } = require(${JSON.stringify(require.resolve('../src'))})

      exports.default = new Umzug({
				migrations: {
					glob: ['migrations/*.{js,ts,sql}', { cwd: __dirname }],
					resolve: (params) => ({ ...params, up: async () => {}, down: async () => {} }),
				},
				storage: new JSONStorage({path: __dirname + '/storage.json'}),
      })
		`,
		'template.js': `exports.default = filepath => [[filepath, 'select 123']]`,
		'bad-template.js': `exports.default = filepath => [filepath, 'blah']`, // should be an array of pairs, not just a pair
		'storage.json': '[]',
		migrations: {},
	});
	syncer.sync();
	del.sync(path.join(syncer.baseDir, 'migrations/'));

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

		await expect(runCLI(['create', '--name', 'm4.txt'])).rejects.toThrowErrorMatchingInlineSnapshot(
			`"Extension .txt not allowed. Allowed extensions are .js, .ts, .sql. See help for --allow-extension to avoid this error."`
		);

		await expect(runCLI(['create', '--name', 'm4.txt', '--allow-extension', '.txt'])).rejects.toThrowError(
			/Expected .*2000.01.06T00.00.00.m4.txt to be a pending migration but it wasn't! You should investigate this./
		);

		await expect(runCLI(['create', '--name', 'm4.txt', '--allow-extension', '.txt', '--skip-verify'])).resolves
			.toMatchInlineSnapshot(`
					Object {
					  "2000.01.07T00.00.00.m4.txt": "",
					}
				`);

		await expect(runCLI(['create', '--name', 'm5.js', '--prefix', 'DATE'])).resolves.toMatchInlineSnapshot(`
					Object {
					  "2000.01.08.m5.js": "exports.up = params => {};
					exports.down = params => {};
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
		await expect(runCLI(['create', '--name', '000.m6.js', '--prefix', 'NONE', '--allow-confusing-ordering'])).resolves
			.toMatchInlineSnapshot(`
					Object {
					  "000.m6.js": "exports.up = params => {};
					exports.down = params => {};
					",
					}
				`);

		await expect(runCLI(['create', '--name', 'm7.sql', '--template', path.join(syncer.baseDir, 'template.js')]))
			.resolves.toMatchInlineSnapshot(`
					Object {
					  "2000.01.11T00.00.00.m7.sql": "select 123",
					}
				`);

		await expect(
			runCLI(['create', '--name', 'm8.sql', '--template', path.join(syncer.baseDir, 'bad-template.js')])
		).rejects.toThrowError(
			/Expected \[filepath, content] pair. Check that template .*bad-template.js returns an array of pairs. See help for more info./
		);

		const badTemplateRelative = path.relative(process.cwd(), path.join(syncer.baseDir, 'bad-template.js'));
		await expect(runCLI(['create', '--name', 'm8.sql', '--template', badTemplateRelative])).rejects.toThrowError(
			/Expected \[filepath, content] pair. Check that template .*bad-template.js returns an array of pairs. See help for more info./
		);
	});
});
