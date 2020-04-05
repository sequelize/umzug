export interface MigrationDefinition {
	readonly default?: MigrationDefinition;
	up(): Promise<any>;
	down(): Promise<any>;
}

export interface ShortMigrationOptions {
	wrap?(fn: () => Promise<any>): (() => Promise<any>);
	customResolver?(path: string): MigrationDefinition;
	nameFormatter?(path: string): string;
}
