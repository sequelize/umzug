/* eslint-disable @typescript-eslint/no-var-requires */
const { Umzug } = require('.');
const { UmzugCLI } = require('./lib/cli');

/** @type import('eslint-plugin-codegen').Preset<{ action?: string }> */
exports.cliHelp = ({ options: { action } }) => {
	const cli = new UmzugCLI(new Umzug({ migrations: [], logger: undefined }));
	const helpable = action ? cli.tryGetAction(action) : cli;

	return [
		'```',
		helpable
			.renderHelpText()
			// eslint-disable-next-line no-control-regex
			.replace(/\u001B\[.*?m/g, '') // https://stackoverflow.com/a/25245824/1002973
			.trim()
			.replace(/\n-h$/, '-h'),
		'```',
	].join('\n');
};
