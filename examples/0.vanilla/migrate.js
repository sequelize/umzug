const { Umzug, JSONStorage } = require('umzug');

exports.migrator = new Umzug({
	migrations: {
		glob: 'migrations/*.js',
	},
	context: {directory: __dirname + '/ignoreme'},
	storage: new JSONStorage({path: 'ignoreme/uzmug.json'}),
	logger: console,
});

if (require.main === module) {
	exports.migrator.runAsCLI();
}
