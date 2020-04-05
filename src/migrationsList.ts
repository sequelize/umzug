import { MigrationDefinition } from './types';
import { UmzugConstructorMigrationOptionsB } from './umzug';

export interface MigrationDefinitionWithName extends MigrationDefinition {
	name: string;
}

/**
 * A simple helper to build a list of migrations that is suitable according to
 * Umzug's format.
 *
 * @param {Array} migrations A list of migration. Each one must contain 'up', 'down' and 'name'.
 * @param {Array} parameters A facultative list of parameters that will be given to the 'up' and 'down' functions.
 * @returns {Array} The migrations in Umzug's format
 */
export function migrationsList(migrations: MigrationDefinitionWithName[], parameters: any[] = []): UmzugConstructorMigrationOptionsB {
	const pseudoMigrations = migrations.map(({ up, down, name }) => {
		return {
			file: name,
			testFileName(needle: string): boolean {
				return name.startsWith(needle);
			},
			up,
			down
		};
	});

	/// TODO remove type-cast hack, make pseudoMigrations real migrations
	const migrationOptions: UmzugConstructorMigrationOptionsB = pseudoMigrations as UmzugConstructorMigrationOptionsB;
	migrationOptions.params = parameters;

	return migrationOptions;
}
