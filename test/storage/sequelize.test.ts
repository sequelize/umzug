/* eslint-disable @typescript-eslint/promise-function-async */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
import { SequelizeStorage as Storage } from '../../src';

import * as sequelize from 'sequelize';
import { join } from 'path';
import { v4 as uuid } from 'uuid';
import jetpack = require('fs-jetpack');

// TODO [>=3.0.0]: Investigate whether we are mis-using `model.describe()` here, and get rid of `any`.
// See https://github.com/sequelize/umzug/pull/226 and https://github.com/sequelize/sequelize/issues/12296 for details
const describeModel = (model: any) => model.describe();

describe('sequelize', () => {
	jetpack.cwd(__dirname).dir('tmp', { empty: true });

	const helper = {} as any;
	beforeEach(() => {
		Object.assign(helper, {
			sequelize: new sequelize.Sequelize('database', 'username', 'password', {
				dialect: 'sqlite',
				storage: this.storagePath,
				logging: false,
			}),
			storagePath: join(__dirname, `/../tmp/storage-${uuid()}.sqlite`),
		});
	});

	describe('constructor', () => {
		it('requires a "sequelize" or "model" storage option', () => {
			// eslint-disable-next-line @typescript-eslint/ban-ts-ignore
			// @ts-ignore
			expect(() => new Storage()).toThrowError('One of "sequelize" or "model" storage option is required');
		});

		it('stores needed options', () => {
			const storage = new Storage({ sequelize: helper.sequelize });
			expect(storage).toHaveProperty('sequelize');
			expect(storage).toHaveProperty('model');
			expect(storage).toHaveProperty('columnName');
		});

		it('lazy-initializes model', () => {
			const defineModelSpy = jest.spyOn(helper.sequelize, 'define');
			const getModelSpy = jest.spyOn(helper.sequelize, 'model');
			const storage1 = new Storage({ sequelize: helper.sequelize });

			expect(defineModelSpy).toHaveBeenCalledTimes(1);
			expect(getModelSpy).toHaveBeenCalledTimes(0);

			const storage2 = new Storage({ sequelize: helper.sequelize });

			expect(defineModelSpy).toHaveBeenCalledTimes(1);
			expect(getModelSpy).toHaveBeenCalledTimes(1);

			expect(storage2).toEqual(storage1);
		});

		it('accepts a "sequelize" option and creates a model', () => {
			const storage = new Storage({ sequelize: helper.sequelize });
			expect(storage.model).toBe(helper.sequelize.model('SequelizeMeta'));
			expect(storage.model.getTableName()).toBe('SequelizeMeta');
			return storage.model
				.sync()
				.then(describeModel)
				.then(description => {
					expect(description).toMatchInlineSnapshot(`
						Object {
						  "name": Object {
						    "allowNull": false,
						    "defaultValue": undefined,
						    "primaryKey": true,
						    "type": "VARCHAR(255)",
						  },
						}
					`);
					expect(description.name.type).toBe('VARCHAR(255)');
					// Expect(description.name.defaultValue).to.be.oneOf([null, undefined])
					if (description.name.defaultValue !== undefined) {
						expect(description.name.defaultValue).toBe(null);
					}

					expect(description.name.primaryKey).toBeTruthy();
				});
		});

		it('accepts a "modelName" option', () => {
			const storage = new Storage({
				sequelize: helper.sequelize,
				modelName: 'CustomModel',
			});
			expect(storage.model).toBe(helper.sequelize.model('CustomModel'));
			expect(storage.model.getTableName()).toBe('CustomModels');
		});

		it('accepts a "tableName" option', () => {
			const storage = new Storage({
				sequelize: helper.sequelize,
				tableName: 'CustomTable',
			});
			expect(storage.model).toBe(helper.sequelize.model('SequelizeMeta'));
			expect(storage.model.getTableName()).toBe('CustomTable');
		});

		it('accepts a "columnName" option', () => {
			const storage = new Storage({
				sequelize: helper.sequelize,
				columnName: 'customColumn',
			});
			return storage.model
				.sync()
				.then(describeModel)
				.then(description => {
					expect(description).toMatchInlineSnapshot(`
						Object {
						  "customColumn": Object {
						    "allowNull": false,
						    "defaultValue": undefined,
						    "primaryKey": true,
						    "type": "VARCHAR(255)",
						  },
						}
					`);
				});
		});

		it('accepts a "timestamps" option', () => {
			const storage = new Storage({
				sequelize: helper.sequelize,
				timestamps: true,
			});
			return storage.model
				.sync()
				.then(describeModel)
				.then(description => {
					expect(description).toMatchInlineSnapshot(`
						Object {
						  "createdAt": Object {
						    "allowNull": false,
						    "defaultValue": undefined,
						    "primaryKey": false,
						    "type": "DATETIME",
						  },
						  "name": Object {
						    "allowNull": false,
						    "defaultValue": undefined,
						    "primaryKey": true,
						    "type": "VARCHAR(255)",
						  },
						  "updatedAt": Object {
						    "allowNull": false,
						    "defaultValue": undefined,
						    "primaryKey": false,
						    "type": "DATETIME",
						  },
						}
					`);
				});
		});

		it('accepts a "columnType" option', () => {
			const storage = new Storage({
				sequelize: helper.sequelize,
				columnType: new sequelize.STRING(190),
			});
			return storage.model
				.sync()
				.then(describeModel)
				.then(description => {
					expect(description.name.type).toBe('VARCHAR(190)');
					// Expect(description.name.defaultValue).to.be.oneOf([null, undefined])
					if (description.name.defaultValue !== undefined) {
						expect(description.name.defaultValue).toBe(null);
					}

					expect(description.name.primaryKey).toBe(true);
				});
		});

		it('accepts a "model" option', () => {
			const Model = helper.sequelize.define('CustomModel', {
				columnName: {
					type: sequelize.STRING,
				},
				someOtherColumn: {
					type: sequelize.INTEGER,
				},
			});

			const storage = new Storage({
				model: Model,
			});
			expect(storage.model).toBe(Model);
		});
	});

	describe('logMigration', () => {
		it("creates the table if it doesn't exist yet", () => {
			const storage = new Storage({
				sequelize: helper.sequelize,
			});

			return storage.model.sequelize
				.getQueryInterface()
				.showAllTables()
				.then(allTables => {
					expect(Object.keys(allTables)).toHaveLength(0);
				})
				.then(() => storage.logMigration('asd.js'))
				.then(() => storage.model.sequelize.getQueryInterface().showAllTables())
				.then(allTables => {
					expect(allTables).toEqual(['SequelizeMeta']);
				});
		});

		it('writes the migration to the database', () => {
			const storage = new Storage({
				sequelize: helper.sequelize,
			});

			return storage
				.logMigration('asd.js')
				.then(() => storage.model.findAll())
				.then(migrations => {
					expect(migrations.length).toBe(1);
					expect(migrations[0].name).toBe('asd.js');
				});
		});

		it('writes the migration to the database with a custom column name', () => {
			const storage = new Storage({
				sequelize: helper.sequelize,
				columnName: 'customColumnName',
			});

			return storage
				.logMigration('asd.js')
				.then(() => storage.model.findAll())
				.then(migrations => {
					expect(migrations.length).toBe(1);
					expect(migrations[0].customColumnName).toBe('asd.js');
				});
		});

		it('writes the migration to the database with timestamps', () => {
			const storage = new Storage({
				sequelize: helper.sequelize,
				timestamps: true,
			});

			// Sequelize | startTime | createdAt | endTime
			// <= v2     | .123      | .000      | .456
			// >= v3     | .123      | .345      | .456
			// Sequelize <= v2 doesn't store milliseconds in timestamps so comparing
			// it to startTime with milliseconds fails. That's why we ignore
			// milliseconds in startTime too.
			const startTime = new Date(Math.floor(Date.now() / 1000) * 1000);

			return storage
				.logMigration('asd.js')
				.then(() => storage.model.findAll())
				.then(migrations => {
					expect(migrations.length).toBe(1);
					expect(migrations[0].name).toBe('asd.js');
					expect(migrations[0].createdAt.getTime()).toBeGreaterThanOrEqual(startTime.getTime());
					expect(migrations[0].createdAt.getTime()).toBeLessThanOrEqual(new Date().getTime());
				});
		});
	});

	describe('unlogMigration', () => {
		it("creates the table if it doesn't exist yet", () => {
			const storage = new Storage({ sequelize: helper.sequelize });

			return storage.model.sequelize
				.getQueryInterface()
				.showAllTables()
				.then(allTables => {
					expect(Object.keys(allTables)).toHaveLength(0);
				})
				.then(() => storage.unlogMigration('asd.js'))
				.then(() => storage.model.sequelize.getQueryInterface().showAllTables())
				.then(allTables => {
					expect(allTables).toEqual(['SequelizeMeta']);
				});
		});

		it('deletes the migration from the database', () => {
			const storage = new Storage({ sequelize: helper.sequelize });

			return storage
				.logMigration('asd.js')
				.then(() => storage.model.findAll())
				.then(migrations => {
					expect(migrations.length).toBe(1);
				})
				.then(() => storage.unlogMigration('asd.js'))
				.then(() => storage.model.findAll())
				.then(migrations => {
					expect(Object.keys(migrations)).toHaveLength(0);
				});
		});

		it('deletes only the passed migration', () => {
			const storage = new Storage({ sequelize: helper.sequelize });

			return storage
				.logMigration('migration1.js')
				.then(() => storage.logMigration('migration2.js'))
				.then(() => storage.unlogMigration('migration2.js'))
				.then(() => storage._model().findAll())
				.then(migrations => {
					expect(migrations.length).toBe(1);
					expect(migrations[0].name).toBe('migration1.js');
				});
		});

		it('deletes the migration from the database with a custom column name', () => {
			const storage = new Storage({
				sequelize: helper.sequelize,
				columnName: 'customColumnName',
			});

			return storage
				.logMigration('asd.js')
				.then(() => storage.model.findAll())
				.then(migrations => {
					expect(migrations.length).toBe(1);
				})
				.then(() => storage.unlogMigration('asd.js'))
				.then(() => storage.model.findAll())
				.then(migrations => {
					expect(Object.keys(migrations)).toHaveLength(0);
				});
		});

		it('deletes the migration from the database with timestamps', () => {
			const storage = new Storage({
				sequelize: helper.sequelize,
				timestamps: true,
			});

			return storage
				.logMigration('asd.js')
				.then(() => storage.model.findAll())
				.then(migrations => {
					expect(migrations.length).toBe(1);
				})
				.then(() => storage.unlogMigration('asd.js'))
				.then(() => storage.model.findAll())
				.then(migrations => {
					expect(Object.keys(migrations)).toHaveLength(0);
				});
		});
	});

	describe('executed', () => {
		it('validates migration types', async () => {
			const storage = new Storage({ sequelize: helper.sequelize });

			jest.spyOn(storage.model, 'findAll').mockResolvedValueOnce([{ name: 123 } as any]);

			await expect(storage.executed()).rejects.toThrowErrorMatchingInlineSnapshot(
				`"Unexpected migration name type: expected string, got number"`
			);
		});

		it("creates the table if it doesn't exist yet", () => {
			const storage = new Storage({
				sequelize: helper.sequelize,
			});

			return storage.model.sequelize
				.getQueryInterface()
				.showAllTables()
				.then(allTables => {
					expect(Object.keys(allTables)).toHaveLength(0);
				})
				.then(() => storage.executed())
				.then(() => storage.model.sequelize.getQueryInterface().showAllTables())
				.then(allTables => {
					expect(allTables).toEqual(['SequelizeMeta']);
				});
		});

		it('returns an empty array if no migrations were logged yet', () => {
			const storage = new Storage({
				sequelize: helper.sequelize,
			});

			return storage.executed().then(migrations => {
				expect(Object.keys(migrations)).toHaveLength(0);
			});
		});

		it('returns executed migrations', () => {
			const storage = new Storage({
				sequelize: helper.sequelize,
			});

			return storage
				.logMigration('asd.js')
				.then(() => storage.executed())
				.then(migrations => {
					expect(migrations).toEqual(['asd.js']);
				});
		});

		it('returns executed migrations with a custom column name', () => {
			const storage = new Storage({
				sequelize: helper.sequelize,
				columnName: 'customColumnName',
			});

			return storage
				.logMigration('asd.js')
				.then(() => storage.executed())
				.then(migrations => {
					expect(migrations).toEqual(['asd.js']);
				});
		});

		it('returns executed migrations with timestamps', () => {
			const storage = new Storage({
				sequelize: helper.sequelize,
				timestamps: true,
			});

			return storage
				.logMigration('asd.js')
				.then(() => storage.executed())
				.then(migrations => {
					expect(migrations).toEqual(['asd.js']);
				});
		});
	});
});
