import { MigrationDefinition } from './migration';
import { UmzugConstructorMigrationOptionsB } from './umzug';

export interface MigrationDefinitionWithName extends MigrationDefinition {
	name: string;
}

/**
 * A simple helper to build a list of migrations that is suitable according to
 * Umzug's format.
 *
 * @param {Array} migrations A list of migration. Each one must contain 'up', 'down' and 'name'.
 * @param {Array} params A facultative list of params that will be given to the 'up' and 'down' functions.
 * @returns {Array} The migrations in Umzug's format
 */
export function migrationsList(migrations: MigrationDefinitionWithName[], params: any[] = []): UmzugConstructorMigrationOptionsB {
	let pseudoMigrations = migrations.map(({ up, down, name }) => {
		return {
			file: name,
			testFileName(needle) {
				return this.file.startsWith(needle);
			},
			up,
			down
		};
	});

	// TODO remove type-cast hack, make pseudoMigrations real migrations
	const migrationOptions: UmzugConstructorMigrationOptionsB = pseudoMigrations as UmzugConstructorMigrationOptionsB;
	migrationOptions.params = params;

	return migrationOptions;
}
