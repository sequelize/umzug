import type {UmzugStorage} from './contract'

export const memoryStorage = (): UmzugStorage => {
	let executed: string[] = []
	return {
		async logMigration({name}) {
			executed.push(name)
		},
		async unlogMigration({name}) {
			executed = executed.filter(n => n !== name)
		},
		executed: async () => [...executed],
	}
}
