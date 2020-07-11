import { Sequelize } from 'sequelize';
import { SequelizeStorage } from '../src';
import { Umzug2 } from '../src/umzug';
import { fsSyncer } from 'fs-syncer';
import * as path from 'path';

describe('v2 parity', () => {
	test('sequelize integration test', async () => {
		const baseDir = path.join(__dirname, 'generated/sequelize/integration');

		const syncer = fsSyncer(path.join(baseDir, 'migrations'), {
			'00_initial.js': `
				const { Sequelize } = require('sequelize');

				async function up(queryInterface) {
					await queryInterface.createTable('users', {
						id: {
							type: Sequelize.INTEGER,
							allowNull: false,
							primaryKey: true
						},
						name: {
							type: Sequelize.STRING,
							allowNull: false
						}
					});
				}
				
				async function down(queryInterface) {
					await queryInterface.dropTable('users');
				}
				
				module.exports = { up, down };
			`,
		});
		syncer.sync();

		const sequelize = new Sequelize({
			dialect: 'sqlite',
			storage: path.join(baseDir, 'db.sqlite'),
			logging: false,
		});

		const context = sequelize.getQueryInterface();
		const umzug = new Umzug2({
			migrations: {
				glob: ['migrations/*.js', { cwd: baseDir }],
				resolve: ({ path, context }) => {
					// umzug v2.x received context directly - this resolve function supports migrations written for v2
					// eslint-disable-next-line @typescript-eslint/no-var-requires
					const migration = require(path);
					return { up: () => migration.up(context), down: () => migration.down(context) };
				},
			},
			context,
			storage: new SequelizeStorage({ sequelize }),
			logging: false,
		});

		const tableCount = () => {
			const sql = `
        SELECT count(*) as count
        FROM sqlite_master
        WHERE type='table'
        AND name='users'
      `;
			return context.sequelize.query(sql).then(([results]) => results[0]);
		};

		expect(await tableCount()).toEqual({ count: 0 });

		await umzug.up();

		expect(await tableCount()).toEqual({ count: 1 });

		await umzug.down();

		expect(await tableCount()).toEqual({ count: 0 });
	});
});
