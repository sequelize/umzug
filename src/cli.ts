import * as cli from '@rushstack/ts-command-line';
import { Umzug } from './umzug';
import * as path from 'path';
import * as fs from 'fs';

export abstract class ApplyMigrationsAction extends cli.CommandLineAction {
	private _params: ReturnType<typeof ApplyMigrationsAction._defineParameters>;

	protected constructor(
		protected readonly parent: { getUmzug(): Umzug<{}> },
		cliOptions: cli.ICommandLineActionOptions
	) {
		super(cliOptions);
	}

	private static _defineParameters(action: cli.CommandLineAction) {
		const verb = {
			up: 'applied',
			down: 'reverted',
		}[action.actionName as 'up' | 'down'];

		return {
			to: action.defineStringParameter({
				parameterLongName: '--to',
				argumentName: 'NAME',
				// prettier-ignore
				description: `All migrations up to and including this one should be ${verb}. ${verb === 'reverted' ? 'Pass "0" to revert all.' : ''}`.trim(),
			}),
			migrations: action.defineStringListParameter({
				parameterLongName: '--migration',
				argumentName: 'NAME',
				description: `List of migrations to be ${verb}`,
			}),
			rerun: action.defineChoiceParameter({
				parameterLongName: '--rerun',
				description: `Specify what action should be taken when a migration that has already been ${verb} is passed`,
				alternatives: ['THROW', 'SKIP', 'ALLOW'],
				defaultValue: 'THROW',
			}),
		};
	}

	onDefineParameters(): void {
		this._params = ApplyMigrationsAction._defineParameters(this);
	}

	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	protected getParams() {
		const {
			migrations: { values: migrations },
			rerun: { value: rerun },
			to: { value: to },
		} = this._params;

		if (to && migrations.length > 0) {
			throw new Error(`Can't specify 'to' and 'migrations' together`);
		}

		if (rerun !== 'THROW' && migrations.length === 0) {
			throw new Error(`Can't specify 'rerun' without 'migrations'`);
		}

		return { migrations, rerun, to };
	}
}

export class UpAction extends ApplyMigrationsAction {
	constructor(parent: { getUmzug(): Umzug<{}> }) {
		super(parent, {
			actionName: 'up',
			summary: 'Applies pending migrations',
			documentation: 'Performs all migrations. See --help for more options',
		});
	}

	async onExecute(): Promise<void> {
		const umzug = this.parent.getUmzug();
		type Opts = Parameters<typeof umzug.up>[0];

		const { migrations, rerun, to } = this.getParams();

		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
		const opts = {
			to,
			migrations: migrations.length > 0 ? migrations : undefined,
			rerun,
		} as Opts;

		await umzug.up(opts);
	}
}

export class DownAction extends ApplyMigrationsAction {
	constructor(parent: { getUmzug(): Umzug<{}> }) {
		super(parent, {
			actionName: 'down',
			summary: 'Revert migrations',
			documentation:
				'Undoes previously-applied migrations. By default, undoes the most recent migration only. Use --help for more options. Useful in development to start from a clean slate. Use with care in production!',
		});
	}

	async onExecute(): Promise<void> {
		const umzug = this.parent.getUmzug();
		type Opts = Parameters<typeof umzug.down>[0];

		const { migrations, rerun, to } = this.getParams();

		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
		const opts = {
			to: to === '0' ? 0 : to,
			migrations: migrations.length > 0 ? migrations : undefined,
			rerun,
		} as Opts;

		await umzug.down(opts);
	}
}

class ListAction extends cli.CommandLineAction {
	private _params: ReturnType<typeof ListAction._defineParameters>;

	constructor(private readonly action: 'pending' | 'executed', private readonly parent: { getUmzug: () => Umzug<{}> }) {
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
		const migrations = await this.parent.getUmzug()[this.action]();
		const formatted = this._params.json.value
			? JSON.stringify(migrations, null, 2)
			: migrations.map(m => m.name).join('\n');
		// eslint-disable-next-line no-console
		console.log(formatted);
	}
}

export class CreateAction extends cli.CommandLineAction {
	private _params: ReturnType<typeof CreateAction._defineParameters>;

	constructor(readonly parent: { getUmzug: () => Umzug<{}> }) {
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
		const umzug = this.parent.getUmzug();

		await umzug.create({
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			name: this._params.name.value!,
			prefix: this._params.prefix.value as 'TIMESTAMP' | 'DATE' | 'NONE',
			folder: this._params.folder.value,
			allowExtension: this._params.allowExtension.values.length > 0 ? this._params.allowExtension.values[0] : undefined,
			allowConfusingOrdering: this._params.allowConfusingOrdering.value,
			skipVerify: this._params.skipVerify.value,
		});
	}
}

export class UmzugCLI extends cli.CommandLineParser {
	constructor(readonly getUmzug: () => Umzug<{}>) {
		super({
			toolFilename: '<script>',
			toolDescription: 'Umzug migrator',
		});

		this.addAction(new UpAction(this));
		this.addAction(new DownAction(this));
		this.addAction(new ListAction('pending', this));
		this.addAction(new ListAction('executed', this));
		this.addAction(new CreateAction(this));
	}

	onDefineParameters(): void {}
}
