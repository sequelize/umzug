export class Storage {
  async logMigration(migrationName: string): Promise<void> {}

  async unlogMigration(migrationName: string): Promise<void> {}

  async executed(): Promise<string[]> {
    return [];
  }
}
