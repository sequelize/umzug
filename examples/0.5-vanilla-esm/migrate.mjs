import { Umzug, JSONStorage } from 'umzug';
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url)).replace(/\/$/, '')

export const migrator = new Umzug({
	migrations: {
		glob: 'migrations/*.*js',
	},
	context: { directory: __dirname + '/ignoreme' },
	storage: new JSONStorage({ path: __dirname + '/ignoreme/storage.json' }),
	logger: console,
});

await migrator.runAsCLI();
