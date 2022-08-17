import { MigrationParams } from '../types';

export type UmzugStorage<Ctx = unknown> = {
	/**
	 * Logs migration to be considered as executed.
	 */
	logMigration: (params: MigrationParams<Ctx>) => Promise<void>;

	/**
	 * Unlogs migration (makes it to be considered as pending).
	 */
	unlogMigration: (params: MigrationParams<Ctx>) => Promise<void>;

	/**
	 * Gets list of executed migrations.
	 */
	executed: (meta: Pick<MigrationParams<Ctx>, 'context'>) => Promise<string[]>;
};

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
