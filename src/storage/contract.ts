export interface UmzugStorage {
	lock?: (transactionId: string) => Promise<void>;
	unlock?: (transactionId: string) => Promise<void>;
	/**
	 * Logs migration to be considered as executed.
	 */
	logMigration: (migrationName: string) => Promise<void>;

	/**
	 * Unlogs migration (makes it to be considered as pending).
	 */
	unlogMigration: (migrationName: string) => Promise<void>;

	/**
	 * Gets list of executed migrations.
	 */
	executed: () => Promise<string[]>;
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
