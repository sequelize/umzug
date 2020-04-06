import { UmzugStorage } from './type-helpers/umzug-storage';

export class NoneStorage implements UmzugStorage {
	// eslint-disable-next-line @typescript-eslint/no-empty-function
	async logMigration(_migrationName: string): Promise<void> {}

	// eslint-disable-next-line @typescript-eslint/no-empty-function
	async unlogMigration(_migrationName: string): Promise<void> {}

	async executed(): Promise<string[]> {
		return [];
	}
}
