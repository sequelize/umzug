import { Sequelize } from 'sequelize';
import { SequelizeStorage } from '../src';
import { getUmzug } from '../src/umzug';
import { fsSyncer } from 'fs-syncer';
import * as path from 'path';

describe('v2 parity', () => {
	test('sequelize integration test', async () => {
		const baseDir = path.join(__dirname, 'generated/sequelize/integration');
		const sequelize = new Sequelize({
			dialect: 'sqlite',
			storage: path.join(baseDir, 'db.sqlite'),
			logging: false,
		});

		const context = sequelize.getQueryInterface();
		const umzug = getUmzug({
			migrations: {
				glob: ['migrations/*.js', { cwd: baseDir }],
				resolve: ({ path, context }) => {
					// eslint-disable-next-line @typescript-eslint/no-var-requires
					const migration = require(path);
					return { up: () => migration.up(context), down: () => migration.down(context) };
				},
			},
			context,
			storage: new SequelizeStorage({ sequelize }),
		});

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
            },
            createdAt: {
              type: Sequelize.DATE,
              allowNull: false
            },
            updatedAt: {
              type: Sequelize.DATE,
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

		await umzug.up();

		const [upResults] = await context.sequelize.query(`
      SELECT count(*) as count
      FROM sqlite_master
      WHERE type='table'
      AND name='users'
    `);
		expect(upResults[0]).toEqual({ count: 1 });

		await umzug.down();

		const [downResults] = await context.sequelize.query(`
      SELECT count(*) as count
      FROM sqlite_master
      WHERE type='table'
      AND name='users'
    `);
		expect(downResults[0]).toEqual({ count: 0 });
	});
});
