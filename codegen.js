/* eslint-disable @typescript-eslint/no-var-requires */
const { Umzug } = require('.');
const { UmzugCLI } = require('./lib/cli');
const stripAnsi = require('strip-ansi');

/** @type import('eslint-plugin-codegen').Preset<{ action?: string }> */
exports.cliHelp = ({ options: { action } }) => {
	const cli = new UmzugCLI(new Umzug({ migrations: [], logger: undefined }));
	const helpable = action ? cli.tryGetAction(action) : cli;

	return [
		'```',
		stripAnsi(helpable.renderHelpText())
			.trim()
			// for some reason the last `-h` is on its own line
			.replace(/\n-h$/, '-h'),
		'```',
	].join('\n');
};
