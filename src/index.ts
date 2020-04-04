import { Umzug } from './umzug';
export { Umzug } from './umzug';

import { Migration } from './migration';
export { Migration } from './migration';

import { migrationsList } from './migrationsList';
export { migrationsList } from './migrationsList';

export default { Migration, migrationsList, Umzug };

// For CommonJS default export support
module.exports = { Migration, migrationsList, Umzug };
module.exports.default = { Migration, migrationsList, Umzug };
