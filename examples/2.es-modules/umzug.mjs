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
		glob: ['migrations/*.{js,cjs,mjs}', { cwd: path.dirname(import.meta.url.replace('file:///', '')) }],
		resolve: params => {
			if (params.path.endsWith('.mjs') || params.path.endsWith('.js')) {
				const getModule = () => import(`file:///${params.path.replace(/\\/g, '/')}`)
				return {
					name: params.name,
					path: params.path,
					up: async upParams => (await getModule()).up(upParams),
					down: async downParams => (await getModule()).up(downParams),
				}
			}
			return {
				name: params.name,
				path: params.path,
				...require(params.path),
			}
		}
	},
	context: { sequelize, DataTypes },
	storage: new SequelizeStorage({
		sequelize,
	}),
	logger: console,
});

migrator.runAsCLI()
