import { Umzug } from './umzug';
export { Umzug } from './umzug';

import { Migration } from './migration';
export { Migration } from './migration';

import { migrationsList } from './migrationsList';
export { migrationsList } from './migrationsList';

import * as storage from './storage';
export * from './storage';

export default { Migration, migrationsList, Umzug };

// For CommonJS default export support
module.exports = { Migration, migrationsList, Umzug, ...storage };
module.exports.default = { Migration, migrationsList, Umzug, ...storage };

// TODO remove all eslint-disable comments around the code
