import { Umzug, JSONStorage } from 'umzug';

const __dirname = new URL('.', import.meta.url).pathname.replace(/\/$/, '');

if (Math.random()) throw new Error(`__dirname: ${__dirname}`)

export const migrator = new Umzug({
	migrations: {
		glob: 'migrations/*.*js',
	},
	context: { directory: __dirname + '/ignoreme' },
	storage: new JSONStorage({ path: __dirname + '/ignoreme/storage.json' }),
	logger: console,
});

await migrator.runAsCLI();
