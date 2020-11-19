/* eslint-disable @typescript-eslint/no-var-requires */
const { Umzug } = require('.');
const { UmzugCLI } = require('./lib/cli');

/** @type import('eslint-plugin-codegen').Preset<{ action: string }> */
exports.cliHelp = params => {
	/** @type {any} */
	let cli = new UmzugCLI(new Umzug({ migrations: [], logger: undefined }));
	if (params.options.action) {
		cli = cli.tryGetAction(params.options.action);
	}

	/** @type {string} */
	const helpText = cli._argumentParser.formatHelp();
	return [
		'```',
		helpText
			// eslint-disable-next-line no-control-regex
			.replace(/\u001B\[.*?m/g, '')
			.trim()
			.replace(/\n-h$/, '-h'),
		'```',
	].join('\n');
};
