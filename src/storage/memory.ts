import { UmzugStorage } from './contract';

export const memoryStorage = (): UmzugStorage => {
	const state = { executed: [] as string[] };
	return {
		logMigration: async name => {
			state.executed.push(name);
		},
		unlogMigration: async name => {
			state.executed = state.executed.filter(n => n !== name);
		},
		executed: async () => state.executed,
	};
};
