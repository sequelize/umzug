import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { Umzug, SequelizeStorage } = require('umzug');
const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

const sequelize = new Sequelize({
	dialect: 'sqlite',
	storage: './db.sqlite',
	logging: process.env.SEQUELIZE_LOG === 'true',
});

export const migrator = new Umzug({
	migrations: {
		glob: ['migrations/*.{js,cjs,mjs}', { cwd: path.dirname(import.meta.url.replace('file://', '')) }],
	},
	context: { sequelize, DataTypes },
	storage: new SequelizeStorage({
		sequelize,
	}),
	logger: console,
});

migrator.runAsCLI()
