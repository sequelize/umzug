import { fsSyncer } from 'fs-syncer';
import { GlobalUmzugCLI } from '../src/cli';
import * as path from 'path';
import { Umzug } from '../src';

describe('cli', () => {
	jest.spyOn(console, 'log').mockImplementation(() => {});

	const syncer = fsSyncer(path.join(__dirname, 'generated/cli'), {
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
			'm1.js': `exports.up = exports.down = async params => console.log(params)`,
			'm2.js': `exports.up = exports.down = async params => console.log(params)`,
			'm3.js': `exports.up = exports.down = async params => console.log(params)`,
		},
	});
	syncer.sync();

	const uzmugPath = path.join(syncer.baseDir, 'umzug.js');
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const umzug: Umzug<{}> = require(uzmugPath).default;

	test('requires module', async () => {
		const cli = new GlobalUmzugCLI();

		await expect(cli.executeWithoutErrorHandling(['up'])).rejects.toThrowErrorMatchingInlineSnapshot(`
					"umzug: error: Argument \\"--module\\" is required
					"
				`);
	});

	test('cli', async () => {
		/** run the cli with the specified args, then return the executed migration names */
		const runCli = async (argv: string[]) => {
			await new GlobalUmzugCLI().executeWithoutErrorHandling(argv);
			return (await umzug.executed()).map(e => e.name);
		};

		await expect(runCli(['--module', uzmugPath, 'up'])).resolves.toEqual(['m1.js', 'm2.js', 'm3.js']);
		await expect(runCli(['--module', uzmugPath, 'down'])).resolves.toEqual(['m1.js', 'm2.js']);
		await expect(runCli(['--module', uzmugPath, 'down', '--to', '0'])).resolves.toEqual([]);
		await expect(runCli(['--module', uzmugPath, 'up', '--to', 'm2.js'])).resolves.toEqual(['m1.js', 'm2.js']);

		await expect(runCli(['--module', uzmugPath, 'down', '--to', '0'])).resolves.toEqual([]);

		await expect(runCli(['--module', uzmugPath, 'up', '--migration', 'm1.js', '--to', 'm2.js'])).rejects.toThrowError(
			/Can't specify 'to' and 'migrations' together/
		);

		await expect(
			runCli(['--module', uzmugPath, 'up', '--migration', 'm1.js', '--migration', 'm3.js'])
		).resolves.toEqual(['m1.js', 'm3.js']);

		await expect(runCli(['--module', uzmugPath, 'down', '--migration', 'm1.js'])).resolves.toEqual(['m3.js']);

		await expect(runCli(['--module', uzmugPath, 'up', '--migration', 'm3.js'])).rejects.toThrowError(
			/Couldn't find migration to apply with name "m3.js"/
		);

		await expect(runCli(['--module', uzmugPath, 'up', '--rerun', 'ALLOW'])).rejects.toThrowError(
			/Can't specify 'rerun' without 'migrations'/
		);

		await expect(
			runCli(['--module', uzmugPath, 'up', '--migration', 'm3.js', '--rerun', 'THROW'])
		).rejects.toThrowError(/Couldn't find migration to apply with name "m3.js"/);

		await expect(runCli(['--module', uzmugPath, 'up', '--migration', 'm3.js', '--rerun', 'ALLOW'])).resolves.toEqual([
			'm3.js',
		]);
	});
});
