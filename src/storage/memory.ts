import { StorableMigration, UmzugStorage } from './contract';

export const memoryStorage = (): UmzugStorage => {
	let executed: StorableMigration[] = [];
	return {
		logMigration: async (name, { batch }) => {
			executed.push({ name, batch });
		},
		unlogMigration: async name => {
			executed = executed.filter(n => n.name !== name);
		},
		executed: async () => executed.slice(),
	};
};
