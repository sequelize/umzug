import { UmzugLocker } from '../locking';
import { UmzugStorage } from './contract';

// codegen:start {preset: barrel}
export * from './contract';
export * from './json';
export * from './memory';
export * from './mongodb';
export * from './sequelize';
// codegen:end

/**
 * Add locking to an existing storage object. This will return a new storage object which calls
 * `.lock` in its setup, and `.unlock` in its teardown.
 * Note: any existing setup and teardown functions of the original storage will be called _before_
 * locking/unlocking.
 * @param storage @see UmzugStorage
 * @param locker @see UmzugLocker
 */
export const addLocker = <T>(storage: UmzugStorage<T>, locker: UmzugLocker): UmzugStorage<T & { batchId: string }> => ({
	logMigration: async (...args) => storage.logMigration(...args),
	unlogMigration: async (...args) => storage.unlogMigration(...args),
	executed: async (...args) => storage.executed(...args),
	setup: async context => {
		const batchId = new Date().toISOString();
		await storage.setup?.(context);
		await locker.lock(batchId);
		context.batchId = batchId;
	},
	teardown: async context => {
		await storage.teardown?.(context);
		await locker.unlock(context.batchId);
	},
});
