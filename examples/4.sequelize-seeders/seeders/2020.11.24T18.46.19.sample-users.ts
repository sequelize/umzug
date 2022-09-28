import type { Seeder } from '../umzug';

const seedUsers = [
	{ id: 1, name: 'Alice' },
	{ id: 2, name: 'Bob' },
];

export const up: Seeder = async ({ context: sequelize }) => {
	await sequelize.getQueryInterface().bulkInsert('users', seedUsers);
};

export const down: Seeder = async ({ context: sequelize }) => {
	await sequelize.getQueryInterface().bulkDelete('users', { id: seedUsers.map(u => u.id) });
};
