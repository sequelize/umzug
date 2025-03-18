const {Umzug} = require('.')
const stripAnsi = require('strip-ansi')
const {UmzugCLI} = require('./lib/cli')

/** @type import('eslint-plugin-codegen').Preset<{ action?: string }> */
exports.cliHelp = ({options: {action}}) => {
  const {cli} = new UmzugCLI(new Umzug({migrations: [], logger: undefined}))
  const program = cli.buildProgram({argv: []})
  const command = action ? program.commands.find(c => c.name() === action) : program

  return [
    '```',
    stripAnsi(command?.helpInformation() || program.commands.map(c => c.name()).join('\n'))
      .trim()
      // for some reason the last `-h` is on its own line
      .replace(/\n-h$/, '-h'),
    '```',
  ].join('\n')
}
