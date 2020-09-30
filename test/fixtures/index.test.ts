/* eslint-disable jest/expect-expect */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-var-requires */
const { readFileSync, mkdirSync } = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const { Umzug, SequelizeStorage } = require('../../src');
const { v4: uuid } = require('uuid');
const { Migration } = require('../../src/migration');

describe('custom resolver', () => {
	let state: any = {};
	beforeEach(() => {
		state = {};
		state.storagePath = path.join(__dirname, `/../generated/sqlite/storage-${uuid()}.sqlite`);
		mkdirSync(path.dirname(state.storagePath), { recursive: true });
		state.sequelize = new Sequelize('database', 'username', 'password', {
			dialect: 'sqlite',
			storage: state.storagePath,
			logging: false,
		});

		state.umzug = () => {
			if (!state.path || !state.pattern) {
				throw new Error('path and pattern must be defined');
			}

			return new Umzug({
				migrations: {
					path: state.path,
					params: [state.sequelize.getQueryInterface(), state.sequelize.constructor],
					pattern: state.pattern,
					customResolver: state.customResolver,
					nameFormatter: filepath => path.parse(filepath).name,
				},
				storage: new SequelizeStorage({
					path: state.storagePath,
					sequelize: state.sequelize,
				}),
			});
		};

		state.verifyTables = async () => {
			const tables = await state.sequelize.query("select * from sqlite_master where type='table'", {
				type: Sequelize.QueryTypes.SHOWTABLES,
			});

			expect(tables.sort()).toEqual(['SequelizeMeta', 'thing', 'user']);
		};

		state.verifyMeta = async () => {
			const [meta] = await state.sequelize.query('select * from `SequelizeMeta`');

			expect(meta).toEqual([{ name: '1.users' }, { name: '2.things' }]);
		};
	});

	it('resolves javascript files if no custom resolver is defined', async () => {
		state.pattern = /\.js$/;
		state.path = path.resolve(__dirname, 'javascript');
		state.customResolver = undefined;

		await state.umzug().up();

		await state.verifyTables();
		await state.verifyMeta();
	});

	it('an array of migrations created manually can be passed in', async () => {
		const umzug = new Umzug({
			migrations: [
				new Migration(require.resolve('./javascript/1.users'), {
					migrations: {
						wrap: fn => () => fn(state.sequelize.getQueryInterface(), state.sequelize.constructor),
						nameFormatter: filepath => path.parse(filepath).name,
					},
				}),
				new Migration(require.resolve('./javascript/2.things'), {
					migrations: {
						wrap: fn => () => fn(state.sequelize.getQueryInterface(), state.sequelize.constructor),
						nameFormatter: filepath => path.parse(filepath).name,
					},
				}),
			],
			storage: new SequelizeStorage({
				path: state.storagePath,
				sequelize: state.sequelize,
			}),
		});

		await umzug.up();

		await state.verifyTables();
		await state.verifyMeta();
	});

	it('can resolve sql files', async () => {
		state.pattern = /\.sql$/;
		state.path = path.resolve(__dirname, 'sql');
		state.customResolver = filepath => ({
			up: () => state.sequelize.query(readFileSync(filepath, 'utf8')),
		});

		await state.umzug().up();

		await state.verifyTables();
		await state.verifyMeta();
	});
});
