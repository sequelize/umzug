import _path from 'path';
import helper from './helper';

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
   * @param {String} options.upName - Name of the method `up` in migration
   * module.
   * @param {String} options.downName - Name of the method `down` in migration
   * module.
   * @param {Object} options.migrations
   * @param {Migration~wrap} options.migrations.wrap - Wrapper function for
   * migration methods.
   * @param {Migration~customResolver} [options.migrations.customResolver] - A
   * function that specifies how to get a migration object from a path. This
   * should return an object of the form { up: Function, down: Function }.
   * Without this defined, a regular javascript import will be performed.
   * @constructs Migration
   */
  constructor (path, options) {
    this.path = _path.resolve(path);
    this.file = _path.basename(this.path);
    this.options = options;
  }

  /**
   * Tries to require migration module. CoffeeScript support requires
   * 'coffee-script' to be installed.
   * To require other file types, like TypeScript or raw sql files, a
   * custom resolver can be used.
   *
   * @returns {Promise.<Object>} Required migration module
   */
  migration () {
    if (typeof this.options.migrations.customResolver === 'function') {
      return this.options.migrations.customResolver(this.path);
    }
    if (this.path.match(/\.coffee$/)) {
      // 1.7.x compiler registration
      helper.resolve('coffee-script/register') ||

      // Prior to 1.7.x compiler registration
      helper.resolve('coffee-script') ||
      /* jshint expr: true */
      (function () {
        console.error('You have to add "coffee-script" to your package.json.');
        process.exit(1);
      })();
    }

    return require(this.path);
  }

  /**
   * Executes method `up` of migration.
   *
   * @returns {Promise}
   */
  up () {
    return this._exec(this.options.upName, [].slice.apply(arguments));
  }

  /**
   * Executes method `down` of migration.
   *
   * @returns {Promise}
   */
  down () {
    return this._exec(this.options.downName, [].slice.apply(arguments));
  }

  /**
   * Check if migration file name is starting with needle.
   * @param {String} needle - The beginning of the file name.
   * @returns {boolean}
   */
  testFileName (needle) {
    return this.file.indexOf(needle) === 0;
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

    await wrappedFun.apply(migration, args);
  }
};
