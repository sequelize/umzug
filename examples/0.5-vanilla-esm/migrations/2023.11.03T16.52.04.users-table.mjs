import { promises as fs } from 'fs';

/** @type {typeof import('../migrate.mjs').migrator['_types']['migration']} */
export const up = async ({ context }) => {
	await fs.mkdir(context.directory, { recursive: true });
	await fs.writeFile(context.directory + '/users.json', JSON.stringify([], null, 2));
};

/** @type {typeof import('../migrate.mjs').migrator['_types']['migration']} */
export const down = async ({ context }) => {
	await fs.unlink(context.directory + '/users.json');
};
