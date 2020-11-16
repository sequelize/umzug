import { fsSyncer } from 'fs-syncer';
import { GlobalUmzugCLI, UmzugCLI } from '../src/cli';
import * as path from 'path';
import { Umzug } from '../src';

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
