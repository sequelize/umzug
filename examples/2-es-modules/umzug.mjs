import { Umzug, SequelizeStorage } from 'umzug';
import { Sequelize, DataTypes } from 'sequelize';
import * as path from 'path';
import os from 'os';

const sequelize = new Sequelize({
	dialect: 'sqlite',
	storage: './db.sqlite',
	logging: process.env.SEQUELIZE_LOG === 'true',
});

export const migrator = new Umzug({
	migrations: {
		glob: ['migrations/*.{js,cjs,mjs}', { cwd: path.dirname(import.meta.url.replace(os.platform() === 'win32' ? 'file:///' : 'file://', '')) }],
	},
	context: { sequelize, DataTypes },
	storage: new SequelizeStorage({
		sequelize,
	}),
	logger: console,
});

migrator.runAsCLI();
