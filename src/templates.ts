// templates for migration file creation

export const js = `
exports.up = async params => {};
exports.down = async params => {};
`.trimStart();

export const ts = `
import { MigrationFn } from 'umzug';

export const up: MigrationFn = params => {};
export const down: MigrationFn = params => {};
`.trimStart();

export const mjs = `
export const up = params => {};
export const down = params => {};
`;

export const sqlUp = `
-- up migration
`.trimStart();

export const sqlDown = `
-- up migration
`.trimStart();
