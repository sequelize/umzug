import * as cli from '@rushstack/ts-command-line';
import { Umzug } from './umzug';

export abstract class ApplyMigrationsAction extends cli.CommandLineAction {
	private _params: ReturnType<typeof ApplyMigrationsAction._defineParameters>;

	private static _defineParameters(action: cli.CommandLineAction) {
		let verb: string;
		const name: string = action.actionName;
		if (name === 'up') {
			verb = 'applied';
		} else if (name === 'down') {
			verb = 'reverted';
		} else {
			throw new Error(`Unexpected action name ${name}`);
		}

		return {
			to: action.defineStringParameter({
				parameterLongName: '--to',
				argumentName: 'NAME',
				description: `All migrations up to and including this one should be ${verb}. ${
					verb === 'reverted' ? 'Pass "0" to revert all.' : ''
				}`.trim(),
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

class UpAction extends ApplyMigrationsAction {
	constructor(private readonly parent: UmzugCLI) {
		super({
			actionName: 'up',
			summary: 'Applies pending migrations',
			documentation: 'Performs all migrations. See --help for more options',
		});
	}

	async onExecute() {
		const umzug = this.parent.umzug;
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

class DownAction extends ApplyMigrationsAction {
	constructor(private readonly parent: UmzugCLI) {
		super({
			actionName: 'down',
			summary: 'Revert migrations',
			documentation:
				'Undoes previously-applied migrations. By default, undoes the most recent migration only. Use --help for more options. Useful in development to start from a clean slate. Use with care in production!',
		});
	}

	async onExecute() {
		const umzug = this.parent.umzug;
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
	constructor(readonly umzug?: Umzug<{}>) {
		super({
			toolFilename: 'umzug',
			toolDescription: 'Umzug migrator',
		});

		this.addAction(new UpAction(this));
		this.addAction(new DownAction(this));
	}

	onDefineParameters(): void {}

	async onExecute() {
		console.log('executing');
	}
}

void new UmzugCLI(new Umzug({ migrations: [], logger: console })).execute();
