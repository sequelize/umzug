import { Umzug, SequelizeStorage, MigrationFn } from 'umzug';
import { Sequelize } from 'sequelize';
import { migrations } from './barrel';

const sequelize = new Sequelize({
	dialect: 'sqlite',
	storage: './db.sqlite',
	logging: false,
});

export const migrator = new Umzug({
	migrations: Object.entries(migrations).map(([path, migration]) => {
		path += '.ts';
		const name = path.replace('./migrations/', '');
		return { name, path, ...migration };
	}),
	context: sequelize,
	storage: new SequelizeStorage({
		sequelize,
	}),
	logger: console,
});

export type Migration = MigrationFn<Sequelize>;

migrator.runAsCLI();
