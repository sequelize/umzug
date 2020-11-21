export interface BatchMeta {
	batchId: string;
}

export interface UmzugStorage {
	setup?: (meta: BatchMeta) => Promise<void>;
	teardown?: (meta: BatchMeta) => Promise<void>;
	/**
	 * Logs migration to be considered as executed.
	 */
	logMigration: (migrationName: string, meta: { batchId: string }) => Promise<void>;

	/**
	 * Unlogs migration (makes it to be considered as pending).
	 */
	unlogMigration: (migrationName: string, meta: { batchId: string }) => Promise<void>;

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
