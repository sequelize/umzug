import type { Seeder } from '../umzug';

const seedData = {
	roles: [{ id: 1, name: 'admin' }],
	user_roles: [{ user_id: 1, role_id: 1 }],
};

export const up: Seeder = async ({ context: sequelize }) => {
	await sequelize.getQueryInterface().bulkInsert('roles', seedData.roles);
	await sequelize.getQueryInterface().bulkInsert('user_roles', seedData.user_roles);
};

export const down: Seeder = async ({ context: sequelize }) => {
	await sequelize.getQueryInterface().bulkDelete('user_roles', { user_id: seedData.user_roles.map(u => u.user_id) });
	await sequelize.getQueryInterface().bulkDelete('roles', { id: seedData.roles.map(r => r.id) });
};
