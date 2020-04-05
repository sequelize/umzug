export class Storage {
	// TODO
	// eslint-disable-next
	constructor(_options?: any) {}

	async logMigration(_migrationName: string): Promise<void> {}

	async unlogMigration(_migrationName: string): Promise<void> {}

	async executed(): Promise<string[]> {
		return [];
	}
}
