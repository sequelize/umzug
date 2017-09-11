import { sync as resolve } from 'resolve';

module.exports = {
  /**
   * Try to require module from file relative to process cwd or regular require.
   *
   * @param {string} packageName - Filename relative to process' cwd or package
   * name to be required.
   * @returns {*|undefined} Required module
   */
  resolve: function (packageName) {
    let result;

    try {
      result = resolve(packageName, { basedir: process.cwd() });
      result = require(result);
    } catch (e) {
      try {
        result = require(packageName);
      } catch (e) {
        result = undefined;
      }
    }

    return result;
  },
};
