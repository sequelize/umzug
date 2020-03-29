const _path = require('path');

/**
 * @class Migration
 */
module.exports = class Migration {
  /**
   * Wrapper function for migration methods.
   *
   * @callback Migration~wrap
   * @param {function} - Migration method to be wrapped.
   * @return {*|Promise}
   */

  /**
   * Constructs Migration.
   *
   * @param {String} path - Path of the migration file.
   * @param {Object} options
   * @param {Object} options.migrations
   * @param {Migration~wrap} options.migrations.wrap - Wrapper function for
   * migration methods.
   * @param {Migration~customResolver} [options.migrations.customResolver] - A
   * function that specifies how to get a migration object from a path. This
   * should return an object of the form { up: Function, down: Function }.
   * Without this defined, a regular javascript import will be performed.
   * @param {Migration~nameFormatter} [options.migrations.nameFormatter] - A
   * function that receives the file path of the migration and returns the name
   * of the migration. This can be used to remove file extensions for example.
   * @constructs Migration
   */
  constructor (path, options = {}) {
    this.path = _path.resolve(path);
    this.options = {
      ...options,
      migrations: {
        nameFormatter: (path) => _path.basename(path),
        ...options.migrations,
      },
    };

    this.file = this.options.migrations.nameFormatter(this.path);
    if (typeof this.file !== 'string') {
      throw new Error(`Unexpected migration formatter result for '${this.path}': expected string, got ${typeof this.file}`);
    }
  }

  /**
   * Tries to require migration module.
   *
   * @returns {Promise.<Object>} Required migration module
   */
  migration () {
    if (typeof this.options.migrations.customResolver === 'function') {
      return this.options.migrations.customResolver(this.path);
    }

    return require(this.path);
  }

  /**
   * Executes method `up` of migration.
   *
   * @returns {Promise}
   */
  up () {
    return this._exec('up', [].slice.apply(arguments));
  }

  /**
   * Executes method `down` of migration.
   *
   * @returns {Promise}
   */
  down () {
    return this._exec('down', [].slice.apply(arguments));
  }

  /**
   * Check if migration file name is starting with needle.
   * @param {String} needle - The beginning of the file name.
   * @returns {boolean}
   */
  testFileName (needle) {
    const formattedNeedle = this.options.migrations.nameFormatter(needle);
    return this.file.indexOf(formattedNeedle) === 0;
  }

  /**
   * Executes a given method of migration with given arguments.
   *
   * @param {String} method - Name of the method to be called.
   * @param {*} args - Arguments to be used when called the method.
   * @returns {Promise}
   * @private
   */
  async _exec (method, args) {
    const migration = await this.migration();
    let fun = migration[method];
    if (migration.default) {
      fun = migration.default[method] || migration[method];
    }
    if (!fun) throw new Error('Could not find migration method: ' + method);
    const wrappedFun = this.options.migrations.wrap(fun);
    const result = wrappedFun.apply(migration, args);
    if (!result || typeof result.then !== 'function') {
      throw new Error(`Migration ${this.file} (or wrapper) didn't return a promise`);
    }

    await result;
  }
};
