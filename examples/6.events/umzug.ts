import { Umzug, SequelizeStorage } from 'umzug';
import { Sequelize } from 'sequelize';

const sequelize = new Sequelize({
	dialect: 'sqlite',
	storage: './db.sqlite',
});

export const migrator = new Umzug({
	migrations: {
		glob: ['migrations/*.ts', { cwd: __dirname }],
	},
	context: sequelize,
	storage: new SequelizeStorage({ sequelize }),
	logger: console,
});

const fakeApi = {
	shutdownInternalService: async () => {
		console.log('shutting down...');
	},
	restartInternalService: async () => {
		console.log('restarting!');
	},
};

migrator.on('beforeCommand', async () => {
	await fakeApi.shutdownInternalService();
});

migrator.on('afterCommand', async () => {
	await fakeApi.restartInternalService();
});

export type Migration = typeof migrator._types.migration;
