import { Umzug } from './umzug';
export { Umzug } from './umzug';

import { Migration } from './migration';
export { Migration } from './migration';

import { migrationsList } from './migrationsList';
export { migrationsList } from './migrationsList';

export * from './storage';

export default { Migration, migrationsList, Umzug };

// For CommonJS default export support
// eslint-disable-next-line @typescript-eslint/no-var-requires
const storages = require('./storage');
module.exports = { Migration, migrationsList, Umzug, ...storages };
module.exports.default = { Migration, migrationsList, Umzug, ...storages };

// TODO remove all eslint-disable comments around the code
