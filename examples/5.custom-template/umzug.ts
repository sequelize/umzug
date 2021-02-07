import { Umzug, SequelizeStorage } from 'umzug';
import { Sequelize } from 'sequelize';
import fs = require('fs');
import path = require('path');

const sequelize = new Sequelize({
	dialect: 'sqlite',
	storage: './db.sqlite',
});

export const migrator = new Umzug({
	migrations: {
		glob: ['migrations/*.ts', { cwd: __dirname }],
	},
	context: sequelize,
	storage: new SequelizeStorage({
		sequelize,
	}),
	logger: console,
	create: {
		folder: 'migrations',
		template: filepath => [
			// read template from filesystem
			[filepath, fs.readFileSync(path.join(__dirname, 'template/sample-migration.ts')).toString()],
		],
	},
});

export type Migration = typeof migrator._types.migration;
