import * as cli from '@rushstack/ts-command-line';
import type { MigrateDownOptions, MigrateUpOptions } from './types';
import { Umzug } from './umzug';

export abstract class ApplyMigrationsAction extends cli.CommandLineAction {
	private _params: ReturnType<typeof ApplyMigrationsAction._defineParameters>;
	declare actionName: 'up' | 'down';

	protected constructor(
		protected readonly umzug: Umzug,
		cliOptions: cli.ICommandLineActionOptions & { actionName: 'up' | 'down' }
	) {
		super(cliOptions);
	}

	private static _defineParameters(action: ApplyMigrationsAction) {
		const verb = ApplyMigrationsAction.getVerb(action.actionName);

		return {
			to: action.defineStringParameter({
				parameterLongName: '--to',
				argumentName: 'NAME',
				// prettier-ignore
				description: `All migrations up to and including this one should be ${verb}. ${verb === 'reverted' ? 'Pass "0" to revert all.' : ''}`.trim(),
			}),
			step: action.defineIntegerParameter({
				parameterLongName: '--step',
				argumentName: 'COUNT',
				// prettier-ignore
				description: `Run this many migrations. If not specified, ${verb === 'reverted' ? 'one' : 'all'} will be ${verb}.`,
			}),
			name: action.defineStringListParameter({
				parameterLongName: '--name',
				argumentName: 'MIGRATION',
				description: `Explicity declare migration name(s) to be ${verb}.`,
			}),
			rerun: action.defineChoiceParameter({
				parameterLongName: '--rerun',
				description: `Specify what action should be taken when a migration that has already been ${verb} is passed to --name.`,
				alternatives: ['THROW', 'SKIP', 'ALLOW'],
				defaultValue: 'THROW',
			}),
		};
	}

	onDefineParameters(): void {
		this._params = ApplyMigrationsAction._defineParameters(this);
	}

	private static getVerb(direction: 'up' | 'down') {
		return {
			up: 'applied',
			down: 'reverted',
		}[direction];
	}

	async onExecute(): Promise<void> {
		const {
			to: { value: to },
			step: { value: step },
			name: { values: nameArray },
			rerun: { value: rerun },
		} = this._params;

		// string list parameters are always defined. When they're empty it means nothing was passed.
		const maybeNameArray = nameArray.length > 0 ? nameArray : undefined;

		if (to && maybeNameArray) {
			throw new Error(`Can't specify 'to' and 'name' together`);
		}

		if (to && typeof step === 'number') {
			throw new Error(`Can't specify 'to' and 'step' together`);
		}

		if (typeof step === 'number' && maybeNameArray) {
			throw new Error(`Can't specify 'step' and 'name' together`);
		}

		if (rerun !== 'THROW' && !maybeNameArray) {
			throw new Error(`Can't specify 'rerun' without 'name'`);
		}

		const params = {
			to: to === '0' ? 0 : to,
			step,
			migrations: maybeNameArray,
			rerun,
		};
		const actions = {
			up: async () => this.umzug.up(params as MigrateUpOptions),
			down: async () => this.umzug.down(params as MigrateDownOptions),
		};
		const result = await actions[this.actionName]();

		const verb = ApplyMigrationsAction.getVerb(this.actionName);

		this.umzug.options.logger?.info({ event: this.actionName, message: `${verb} ${result.length} migrations.` });
	}
}

export class UpAction extends ApplyMigrationsAction {
	constructor(umzug: Umzug) {
		super(umzug, {
			actionName: 'up',
			summary: 'Applies pending migrations',
			documentation: 'Performs all migrations. See --help for more options',
		});
	}
}

export class DownAction extends ApplyMigrationsAction {
	constructor(umzug: Umzug) {
		super(umzug, {
			actionName: 'down',
			summary: 'Revert migrations',
			documentation:
				'Undoes previously-applied migrations. By default, undoes the most recent migration only. Use --help for more options. Useful in development to start from a clean slate. Use with care in production!',
		});
	}
}

export class BaselineAction extends cli.CommandLineAction {
	private _params: ReturnType<typeof BaselineAction._defineParameters>;

	constructor(private readonly umzug: Umzug) {
		super({
			actionName: 'baseline',
			summary: `Baselines an existing system to a specific migration`,
			documentation:
				`Running this records all migrations up to the requested one as applied, and un-logs any others. ` +
				`Migrations after the baselined one can then be applied as usual.` +
				`This can be useful for introducing Umzug to an existing database, for example.`,
		});
	}

	private static _defineParameters(action: cli.CommandLineAction) {
		return {
			to: action.defineStringParameter({
				parameterLongName: '--to',
				argumentName: 'MIGRATION_NAME',
				description: `Baseline migrations to this one. All migrations up to and including this one will be recorded as applied.`,
				required: true,
			}),
		};
	}

	onDefineParameters(): void {
		this._params = BaselineAction._defineParameters(this);
	}

	async onExecute(): Promise<void> {
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		await this.umzug.baseline({ to: this._params.to.value! });
	}
}

export class ListAction extends cli.CommandLineAction {
	private _params: ReturnType<typeof ListAction._defineParameters>;

	constructor(private readonly action: 'pending' | 'executed', private readonly umzug: Umzug) {
		super({
			actionName: action,
			summary: `Lists ${action} migrations`,
			documentation: `Prints migrations returned by \`umzug.${action}()\`. By default, prints migration names one per line.`,
		});
	}

	private static _defineParameters(action: cli.CommandLineAction) {
		return {
			json: action.defineFlagParameter({
				parameterLongName: '--json',
				description:
					`Print ${action.actionName} migrations in a json format including names and paths. This allows piping output to tools like jq. ` +
					`Without this flag, the migration names will be printed one per line.`,
			}),
		};
	}

	onDefineParameters(): void {
		this._params = ListAction._defineParameters(this);
	}

	async onExecute(): Promise<void> {
		const migrations = await this.umzug[this.action]();
		const formatted = this._params.json.value
			? JSON.stringify(migrations, null, 2)
			: migrations.map(m => m.name).join('\n');
		// eslint-disable-next-line no-console
		console.log(formatted);
	}
}

export class ValidateAction extends cli.CommandLineAction {
	constructor(private readonly umzug: Umzug) {
		super({
			actionName: 'validate',
			summary: `Validates executed migrations`,
			documentation:
				`Checks that all migrations currently marked as executed match those provided to the umzug instance. ` +
				`Throws an error if any unexpected migrations are found. Errors of this type can be fixed with the ` +
				`\`baseline\` command.`,
		});
	}

	onDefineParameters(): void {}

	async onExecute(): Promise<void> {
		await this.umzug.validate();
		// eslint-disable-next-line no-console
		console.log('Executed migrations are valid.');
	}
}

export class CreateAction extends cli.CommandLineAction {
	private _params: ReturnType<typeof CreateAction._defineParameters>;

	constructor(readonly umzug: Umzug) {
		super({
			actionName: 'create',
			summary: 'Create a migration file',
			documentation:
				'Generates a placeholder migration file using a timestamp as a prefix. By default, mimics the last existing migration, or guesses where to generate the file if no migration exists yet.',
		});
	}

	private static _defineParameters(action: cli.CommandLineAction) {
		return {
			name: action.defineStringParameter({
				parameterLongName: '--name',
				argumentName: 'NAME',
				description: `The name of the migration file. e.g. my-migration.js, my-migration.ts or my-migration.sql. Note - a prefix will be added to this name, usually based on a timestamp. See --prefix`,
				required: true,
			}),
			prefix: action.defineChoiceParameter({
				parameterLongName: '--prefix',
				description:
					'The prefix format for generated files. TIMESTAMP uses a second-resolution timestamp, DATE uses a day-resolution timestamp, and NONE removes the prefix completely',
				alternatives: ['TIMESTAMP', 'DATE', 'NONE'],
				defaultValue: 'TIMESTAMP',
			}),
			folder: action.defineStringParameter({
				parameterLongName: '--folder',
				argumentName: 'PATH',
				description: `Path on the filesystem where the file should be created. The new migration will be created as a sibling of the last existing one if this is omitted.`,
			}),
			allowExtension: action.defineStringListParameter({
				parameterLongName: '--allow-extension',
				argumentName: 'EXTENSION',
				environmentVariable: 'UMZUG_ALLOW_EXTENSION',
				description: `Allowable extension for created files. By default .js, .ts and .sql files can be created. To create txt file migrations, for example, you could use '--name my-migration.txt --allow-extension .txt'`,
			}),
			skipVerify: action.defineFlagParameter({
				parameterLongName: '--skip-verify',
				description:
					`By default, the generated file will be checked after creation to make sure it is detected as a pending migration. This catches problems like creation in the wrong folder, or invalid naming conventions. ` +
					`This flag bypasses that verification step.`,
			}),
			allowConfusingOrdering: action.defineFlagParameter({
				parameterLongName: '--allow-confusing-ordering',
				description:
					`By default, an error will be thrown if you try to create a migration that will run before a migration that already exists. ` +
					`This catches errors which can cause problems if you change file naming conventions. ` +
					`If you use a custom ordering system, you can disable this behavior, but it's strongly recommended that you don't! ` +
					`If you're unsure, just ignore this option.`,
			}),
		};
	}

	onDefineParameters(): void {
		this._params = CreateAction._defineParameters(this);
	}

	async onExecute(): Promise<void> {
		const umzug = this.umzug;

		await umzug
			.create({
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
				name: this._params.name.value!,
				prefix: this._params.prefix.value as 'TIMESTAMP' | 'DATE' | 'NONE',
				folder: this._params.folder.value,
				allowExtension:
					this._params.allowExtension.values.length > 0 ? this._params.allowExtension.values[0] : undefined,
				allowConfusingOrdering: this._params.allowConfusingOrdering.value,
				skipVerify: this._params.skipVerify.value,
			})
			.catch(e => {
				Object.entries(this._params)
					.filter(entry => entry[0] !== 'name')
					.forEach(([name, param]) => {
						// replace `skipVerify` in error messages with `--skip-verify`, etc.
						e.message = e.message?.split(name).join(param.longName);
					});
				throw e;
			});
	}
}

export interface CommandLineParserOptions {
	toolFileName?: string;
	toolDescription?: string;
}

export class UmzugCLI extends cli.CommandLineParser {
	constructor(readonly umzug: Umzug, commandLineParserOptions: CommandLineParserOptions = {}) {
		super({
			toolFilename: commandLineParserOptions.toolFileName ?? '<script>',
			toolDescription: commandLineParserOptions.toolDescription ?? 'Umzug migrator',
		});

		this.addAction(new UpAction(umzug));
		this.addAction(new DownAction(umzug));
		this.addAction(new ListAction('pending', umzug));
		this.addAction(new ListAction('executed', umzug));
		this.addAction(new CreateAction(umzug));
		this.addAction(new ValidateAction(umzug));
		this.addAction(new BaselineAction(umzug));
	}

	onDefineParameters(): void {}
}
