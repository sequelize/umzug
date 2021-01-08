import { UmzugStorage } from './contract';

export const memoryStorage = (): UmzugStorage => {
	let executed: string[] = [];
	return {
		logMigration: async ({ name }) => {
			executed.push(name);
		},
		unlogMigration: async ({ name }) => {
			executed = executed.filter(n => n !== name);
		},
		executed: async () => executed.slice(),
	};
};
