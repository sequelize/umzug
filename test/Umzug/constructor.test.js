/* eslint-disable no-new */
/* eslint-disable @typescript-eslint/no-var-requires */
const { UmzugLegacy: Umzug } = require('../../src');

describe('constructor', () => {
	it('exposes some methods', () => {
		const umzug = new Umzug();

		expect(umzug).toHaveProperty('execute');
		expect(umzug).toHaveProperty('pending');
		expect(umzug).toHaveProperty('up');
		expect(umzug).toHaveProperty('down');
		expect(umzug).toHaveProperty('log');
	});

	it('instantiates the default storage', () => {
		const umzug = new Umzug();
		expect(umzug).toHaveProperty('storage');
	});

	it('uses passed storage object', () => {
		class CustomStorage {
			logMigration() {}
			unlogMigration() {}
			executed() {}
		}

		const storage = new CustomStorage();
		const umzug = new Umzug({ storage });
		expect(umzug).toHaveProperty('storage');
		expect(umzug.storage).toEqual(storage);
	});

	it('throws an error if the specified storage is neither a package nor a file', () => {
		expect(() => {
			new Umzug({ storage: 'nomnom' });
		}).toThrowError('Invalid storage option received: nomnom');
	});

	it('accepts a logging function', () => {
		const spy = jest.fn();
		const umzug = new Umzug({ logging: spy });
		umzug.log();
		expect(spy).toHaveBeenCalledTimes(1);
	});
});
