import { MigrationParams } from '../types';

export interface StorableMigration {
	name: string;
	batch?: string;
}

export interface UmzugStorage<Ctx = unknown> {
	/**
	 * Logs migration to be considered as executed.
	 */
	logMigration: (migrationName: string, params: MigrationParams<Ctx>) => Promise<void>;

	/**
	 * Unlogs migration (makes it to be considered as pending).
	 */
	unlogMigration: (migrationName: string, params: MigrationParams<Ctx>) => Promise<void>;

	/**
	 * Gets list of executed migrations.
	 */
	executed: (meta: Pick<MigrationParams<Ctx>, 'context'>) => Promise<StorableMigration[]>;
}

export function isUmzugStorage(arg: Partial<UmzugStorage>): arg is UmzugStorage {
	return (
		arg &&
		typeof arg.logMigration === 'function' &&
		typeof arg.unlogMigration === 'function' &&
		typeof arg.executed === 'function'
	);
}

export const verifyUmzugStorage = (arg: Partial<UmzugStorage>): UmzugStorage => {
	if (!isUmzugStorage(arg)) {
		throw new Error(`Invalid umzug storage`);
	}

	return arg;
};
