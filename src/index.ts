import { Umzug } from './umzug';
export { Umzug } from './umzug';

import { migrationsList } from './migrationsList';
export { migrationsList } from './migrationsList';

export default { migrationsList, Umzug };

// For CommonJS default export support
module.exports = { migrationsList, Umzug };
module.exports.default = { migrationsList, Umzug };
