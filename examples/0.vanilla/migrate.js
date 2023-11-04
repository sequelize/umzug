const { Umzug, JSONStorage } = require('umzug');

exports.migrator = new Umzug({
	migrations: {
		glob: 'migrations/*.js',
	},
	context: {directory: __dirname + '/ignoreme'},
	storage: new JSONStorage('ignoreme.json'),
	logger: console,
});
