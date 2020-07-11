import { UmzugLegacy } from './umzug';
export { Umzug2, UmzugLegacy } from './umzug';

import { Migration } from './migration';
export { Migration } from './migration';

import { migrationsList } from './migrationsList';
export { migrationsList } from './migrationsList';

import * as storage from './storage';
export * from './storage';

export default { Migration, migrationsList, UmzugLegacy };

// For CommonJS default export support
module.exports = { Migration, migrationsList, UmzugLegacy, ...storage };
module.exports.default = { Migration, migrationsList, UmzugLegacy, ...storage };

// TODO remove all eslint-disable comments around the code
