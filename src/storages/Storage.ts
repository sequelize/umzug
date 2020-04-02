export class Storage {
  async logMigration(_migrationName: string): Promise<void> {}

  async unlogMigration(_migrationName: string): Promise<void> {}

  async executed(): Promise<string[]> {
    return [];
  }
}
