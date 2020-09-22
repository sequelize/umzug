import * as path from 'path';
import { EventEmitter } from 'events';
import * as pEachSeries from 'p-each-series';
import { promisify } from 'util';
import { UmzugStorage, JSONStorage, verifyUmzugStorage } from './storage';
import * as glob from 'glob';
import { basename, extname } from 'path';
import { Promisable } from 'type-fest';

/** Constructor options for the Umzug class */
export interface UmzugOptions<Ctx = never> {
	/** The migrations that the Umzug instance should perform */
	migrations: InputMigrations<Ctx>;
	/** The storage implementation. By default, `JSONStorage` will be used */
	storage?: UmzugStorage;
	/** An optional context object, which will be passed to each migration function, if defined */
	context?: Ctx;
	/** A logging function. If not defined, defaults to a no-op function. */
	logging?: ((...args: any[]) => void) | false;
}

/**
 * A runnable migration. Represents a migration object with an `up` function which can be called directly, with no arguments.
 */
export type Migration = {
	/** Name - this is used to identify the migration persistently in storage */
	name: string;
	/** An optional filepath for the migration. Note: this may be undefined, since not all migrations correspond to files on the filesystem */
	path?: string;

	/** The effect of applying the migration */
	up: () => Promise<unknown>;
	/** The effect of reverting the migration */
	down?: () => Promise<unknown>;
};

/**
 * Allowable inputs for migrations. Can be either glob instructions for migration files, a list of runnable migrations, or a
 * function which receives a context and returns a list of migrations.
 */
export type InputMigrations<T> =
	| {
			/**
			 * A glob string for migration files. Can also be in the format `[path/to/migrations/*.js', {cwd: 'some/base/dir', ignore: '**ignoreme.js' }]`
			 * See https://npmjs.com/package/glob for more details on the glob format - this package is used internally.
			 */
			glob: string | [string, { cwd?: string; ignore?: string | string[] }];
			/** Will be supplied to every migration function. Can be a database client, for example */
			context?: T;
			/** A function which returns `up` and `down` function, from a migration name, path and context. */
			resolve?: Resolver<T>;
	  }
	| Migration[]
	| ((context: T) => Promisable<Migration[]>);

/**
 * A helper property for type inference. After creating an Umzug instance, it can be used as type alias for
 * a user-defined migration. The function receives a migration name, path and the context for an umzug instance
 * @example
 * import { Umzug, MigrationFn } from 'umzug'
 *
 * // my-umzug.ts
 * const myUmzug = new Umzug({...})
 * export type MyMigrationFn = MigrationFn<typeof myUmzug>;
 *
 * // my-migration.ts
 * import type { MigrationFn } from '..'
 *
 * // name and context will be strongly-typed
 * export const up: MigrationFn = ({name, context}) => context.query(...)
 */
export type MigrationFn<U extends Umzug<any>> = U extends Umzug<infer Ctx>
	? (params: { name: string; path?: string; context: Ctx }) => Promise<unknown>
	: never;

/** A function which returns `up` and `down` function, from a migration name, path and context. */
export type Resolver<T> = (params: { path: string; name: string; context: T }) => Migration;

export class Umzug<Ctx> extends EventEmitter {
	private readonly storage: UmzugStorage;
	private readonly migrations: () => Promise<readonly Migration[]>;
	private readonly logging: (...args: unknown[]) => void;

	/** creates a new Umzug instance */
	constructor(private readonly options: UmzugOptions<Ctx>) {
		super();

		this.storage = verifyUmzugStorage(options.storage || new JSONStorage());
		this.migrations = this.getMigrationsResolver();
		this.logging = options.logging || (() => {});
	}

	// todo [>=3.0.0] document how to migrate to v3, which has a breaking change - it passes in path, name, context where v2 passed in context only.
	static defaultResolver: Resolver<unknown> = ({ path: filepath, name, context }) => {
		const ext = path.extname(filepath);
		const canRequire = ext === '.js' || ext in require.extensions;
		const languageSpecificHelp: Record<string, string> = {
			'.ts':
				"You can use the default resolver with typescript files by adding `ts-node` as a dependency and calling `require('ts-node/register')` before running migrations.",
			'.sql': 'Try writing a resolver which reads file content and executes it as a sql query.',
		};
		if (!canRequire) {
			const errorParts = [
				`No resolver specified for file ${filepath}.`,
				languageSpecificHelp[ext],
				`See docs for guidance on how to write a custom resolver.`,
			];
			throw new Error(errorParts.filter(Boolean).join(' '));
		}

		const getModule = () => require(filepath);

		return {
			name,
			path: filepath,
			up: async () => getModule().up({ path: filepath, name, context }) as unknown,
			down: async () => getModule().down({ path: filepath, name, context }) as unknown,
		};
	};

	/**
	 * create a clone of the current Umzug instance, allowing customising the list of migrations.
	 * For example, this could be used to re-order the list of migrations.
	 */
	extend(fn: (migrations: readonly Migration[]) => Promisable<Migration[]>): Umzug<Ctx> {
		return new Umzug({
			...this.options,
			migrations: async () => {
				const migrations = await this.migrations();
				return fn(migrations);
			},
		});
	}

	async executed(): Promise<Migration[]> {
		const [migrations, executedNames] = await Promise.all([this.migrations(), this.storage.executed()]);
		const executedSet = new Set(executedNames);
		return migrations.filter(m => executedSet.has(m.name));
	}

	async pending(): Promise<Migration[]> {
		const [migrations, executedNames] = await Promise.all([this.migrations(), this.storage.executed()]);
		const executedSet = new Set(executedNames);
		return migrations.filter(m => !executedSet.has(m.name));
	}

	async up(options: { to?: string } = {}): Promise<void> {
		const allPending = await this.pending();

		let sliceIndex = allPending.length;
		if (options.to) {
			sliceIndex = this.findNameIndex(allPending, options.to) + 1;
		}

		const toBeApplied = allPending.slice(0, sliceIndex);

		await pEachSeries(toBeApplied, async m => {
			const start = Date.now();
			this.logging('== ' + m.name + ': migrating =======');
			this.emit('migrating', m.name, m);

			await m.up();

			await this.storage.logMigration(m.name);

			const duration = ((Date.now() - start) / 1000).toFixed(3);
			this.logging(`== ${m.name}: migrated (${duration}s)\n`);
			this.emit('migrated', m.name, m);
		});
	}

	async down(options: { to?: string | 0 } = {}): Promise<void> {
		const executedReversed = await this.executed().then(e => e.slice().reverse());

		let sliceIndex = 1;
		if (options.to === 0) {
			sliceIndex = executedReversed.length;
		} else if (options.to) {
			sliceIndex = this.findNameIndex(executedReversed, options.to) + 1;
		}

		const toBeReverted = executedReversed.slice(0, sliceIndex);

		await pEachSeries(toBeReverted, async m => {
			const start = Date.now();
			this.logging('== ' + m.name + ': reverting =======');
			this.emit('reverting', m.name, m);

			await m.down?.();

			await this.storage.unlogMigration(m.name);

			const duration = ((Date.now() - start) / 1000).toFixed(3);
			this.logging(`== ${m.name}: reverted (${duration}s)\n`);
			this.emit('reverted', m.name, m);
		});
	}

	private findNameIndex(migrations: Migration[], name: string) {
		const index = migrations.findIndex(m => m.name === name);
		if (index === -1) {
			throw new Error(`Couldn't find migration with name "${name}"`);
		}

		return index;
	}

	/** helper for parsing input migrations into a callback returning a list of ready-to-run migrations */
	private getMigrationsResolver(): () => Promise<readonly Migration[]> {
		const { migrations: inputMigrations, context } = this.options;
		if (Array.isArray(inputMigrations)) {
			return async () => inputMigrations;
		}

		if (typeof inputMigrations === 'function') {
			return async () => inputMigrations(context);
		}

		const fileGlob = inputMigrations.glob;
		const [globString, globOptions]: Parameters<typeof glob.sync> = Array.isArray(fileGlob) ? fileGlob : [fileGlob];

		const resolver: Resolver<Ctx> = inputMigrations.resolve || Umzug.defaultResolver;

		return async () => {
			// todo [>=3.0.0] deprecate the old `new Umzug(...)` usage and make this "lazier". It'd be good if
			// we could hold off on actually querying the filesystem via glob.sync. Will require a refactor of
			// the main `Umzug` class though, so should wait until this API has been proven out.
			const globAsync = promisify(glob);
			const paths = await globAsync(globString, { ...globOptions, absolute: true });
			return paths.map(unresolvedPath => {
				const filepath = path.resolve(unresolvedPath);
				const name = basename(filepath, extname(filepath));
				return {
					name,
					path: filepath,
					...resolver({ context, path: filepath, name }),
				};
			});
		};
	}
}
