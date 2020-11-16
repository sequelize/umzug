import * as cli from '@rushstack/ts-command-line';
import { Umzug } from './umzug';

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

export class UmzugCLI extends cli.CommandLineParser {
	constructor(readonly getUmzug: () => Umzug<{}>) {
		super({
			toolFilename: 'umzug',
			toolDescription: 'Umzug migrator',
		});

		this.addAction(new UpAction(this));
		this.addAction(new DownAction(this));
	}

	onDefineParameters(): void {}
}

/**
 * extends `UmzugCLI` and adds a `--module` string parameter so the class can be used as a global CLI by pointing
 * at a module which exposes an umzug instance.
 */
export class GlobalUmzugCLI extends UmzugCLI {
	private _module: cli.CommandLineStringParameter;

	constructor() {
		super(() => this._getUmzug());
	}

	onDefineParameters(): void {
		this._module = this.defineStringParameter({
			parameterLongName: '--module',
			argumentName: 'PATH',
			description: `Path to a commonjs module that will be 'require'd. An umzug instance should be the default export`,
			required: true,
		});
	}

	private _getUmzug(): Umzug<{}> {
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		const modulePath = this._module.value!;
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const umzug = require(modulePath).default;

		if (!(umzug instanceof Umzug)) {
			throw new TypeError(`Expected umzug instance to be default export of ${modulePath}`);
		}

		return umzug;
	}
}

// istanbul ignore if
if (require.main === module) {
	void new GlobalUmzugCLI().execute();
}