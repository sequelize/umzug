import { Migration } from '../umzug';
import { DataTypes } from 'sequelize';

// you can put some team-specific imports/code here to be included in every migration

export const up: Migration = async ({ context: sequelize }) => {
	await sequelize.query(`raise fail('up migration not implemented')`);
};

export const down: Migration = async ({ context: sequelize }) => {
	await sequelize.query(`raise fail('down migration not implemented')`);
};
