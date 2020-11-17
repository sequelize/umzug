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
			template: action.defineStringParameter({
				parameterLongName: '--template',
				argumentName: 'PATH',
				environmentVariable: 'UMZUG_MIGRATION_TEMPLATE',
				description:
					'Path to a module (absolute or relative to cwd) which should default export a function. The function receives a string which is the full path of the migration file, and returns an array of [filepath, content] string pairs. ' +
					'In most cases just one pair is needed, being the input filepath and some content, but depending on the project conventions/file type another pair can be included to generate a "down" migration file. ' +
					'If this is omitted, some barebones defaults for javascript, typescript and sql are included.',
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

	private static writer(filepath: string): Array<[string, string]> {
		const dedent = (content: string) =>
			content
				.split('\n')
				.map(line => line.trim())
				.join('\n')
				.trimStart();

		const ext = path.extname(filepath);
		if (ext === '.js') {
			const content = dedent(`
				exports.up = params => {};
				exports.down = params => {};
			`);
			return [[filepath, content]];
		}

		if (ext === '.ts') {
			const content = dedent(`
				export const up = params => {};
				export const down = params => {};
			`);
			return [[filepath, content]];
		}

		if (ext === '.sql') {
			const downFilepath = path.join(path.dirname(filepath), 'down', path.basename(filepath));
			return [
				[filepath, '-- up migration'],
				[downFilepath, '-- down migration'],
			];
		}

		return [];
	}

	onDefineParameters(): void {
		this._params = CreateAction._defineParameters(this);
	}

	async onExecute(): Promise<void> {
		const isoDate = new Date().toISOString();
		const prefixes = {
			TIMESTAMP: isoDate.replace(/\.\d{3}Z$/, '').replace(/\W/g, '.'),
			DATE: isoDate.split('T')[0].replace(/\W/g, '.'),
			NONE: '',
		};
		const prefixType = this._params.prefix.value as 'TIMESTAMP' | 'DATE' | 'NONE';
		const fileBasename = [prefixes[prefixType], this._params.name.value].filter(Boolean).join('.');

		let allowedExtensions = this._params.allowExtension.values;
		if (allowedExtensions.length === 0) {
			allowedExtensions = ['.js', '.ts', '.sql'];
		}

		const maybeFolder = this._params.folder.value;
		const umzug = this.parent.getUmzug();
		const existing = await umzug.migrations();
		const last = existing[existing.length - 1];

		const confusinglyOrdered = existing.find(e => e.path && path.basename(e.path) > fileBasename);
		if (confusinglyOrdered && !this._params.allowConfusingOrdering.value) {
			throw new Error(
				`Can't create ${fileBasename}, since it's unclear if it should run before or after existing migration ${confusinglyOrdered.name}. Use --allow-confusing-ordering to bypass this error.`
			);
		}

		const folder = maybeFolder || (last?.path && path.dirname(last.path));

		if (!folder) {
			throw new Error(
				`Couldn't infer a folder to generate migration file in. Pass '--folder path/to/folder' explicitly`
			);
		}

		const filepath = path.join(folder, fileBasename);

		let writer = CreateAction.writer;
		const templatePath = this._params.template.value && path.resolve(process.cwd(), this._params.template.value);
		if (templatePath) {
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const templateModule = require(templatePath);
			writer = templateModule.default;
		}

		const toWrite = writer(filepath);
		if (toWrite.length === 0) {
			toWrite.push([filepath, '']);
		}

		toWrite.forEach(pair => {
			if (!Array.isArray(pair) || pair.length !== 2) {
				throw new Error(
					`Expected [filepath, content] pair.` +
						(templatePath
							? ` Check that template ${templatePath} returns an array of pairs. See help for more info.`
							: '')
				);
			}

			const ext = path.extname(pair[0]);
			if (!allowedExtensions.includes(ext)) {
				const allowStr = allowedExtensions.join(', ');
				const message = `Extension ${ext} not allowed. Allowed extensions are ${allowStr}. See help for --allow-extension to avoid this error.`;
				throw new Error(message);
			}

			fs.mkdirSync(path.dirname(pair[0]), { recursive: true });
			fs.writeFileSync(pair[0], pair[1]);
			// eslint-disable-next-line no-console
			console.log(`Wrote ${pair[0]}`);
		});

		if (!this._params.skipVerify.value) {
			const pending = await umzug.pending();
			if (!pending.some(p => p.path === filepath)) {
				throw new Error(`Expected ${filepath} to be a pending migration but it wasn't! You should investigate this.`);
			}
		}
	}
}

export class UmzugCLI extends cli.CommandLineParser {
	constructor(toolFilename: string, readonly getUmzug: () => Umzug<{}>) {
		super({
			toolFilename,
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
