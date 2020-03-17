
/**
 * A simple helper to build a list of migrations that is suitable according to
 * Umzug's format.
 *
 * @param {Array} migrations A list of migration. Each one must contain 'up', 'down' and 'name'.
 * @param {Array} params A facultative list of params that will be given to the 'up' and 'down' functions.
 * @returns {Array} The migrations in Umzug's format
 */
export default function migrationsList (migrations, params = []) {
  const tmp = migrations.map(({ up, down, name }) => ({
    file: name,
    testFileName: function (needle) {
      return this.file.indexOf(needle) === 0;
    },
    up,
    down,
  }));
  tmp.params = params;
  return tmp;
}
