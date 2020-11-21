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
export const addLocker = (storage: UmzugStorage, locker: UmzugLocker): UmzugStorage => ({
	logMigration: async (...args) => storage.logMigration(...args),
	unlogMigration: async (...args) => storage.unlogMigration(...args),
	executed: async (...args) => storage.executed(...args),
	setup: async (...args) => {
		await storage.setup?.(...args);
		await locker.lock(args[0].batchId);
	},
	teardown: async (...args) => {
		await storage.teardown?.(...args);
		await locker.unlock(args[0].batchId);
	},
});
