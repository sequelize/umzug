export interface UmzugStorage {
	logMigration(migrationName: string): Promise<void>;
	unlogMigration(migrationName: string): Promise<void>;
	executed(): Promise<string[]>;
}

export function isUmzugStorage(arg: any): arg is UmzugStorage {
	return arg && typeof arg.logMigration === 'function' && typeof arg.unlogMigration === 'function' && typeof arg.executed === 'function';
}
