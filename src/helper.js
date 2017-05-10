import { sync as resolveSync } from 'resolve';

/**
 * Try to require module from file relative to process cwd or regular require.
 *
 * @param {string} packageName - Filename relative to process' cwd or package
 * name to be required.
 * @returns {*|undefined} Required module
 */
export function resolve(packageName) {
  var result;

  try {
    result = resolveSync(packageName, { basedir: process.cwd() });
    result = require(result);
  } catch (e) {
    try {
      result = require(packageName);
    } catch (e) {
      result = undefined;
    }
  }

  return result;
}

/**
 * Take function that accepts callback as its last argument and turn it to
 * function that returns a promise.
 */
export function promisify(fn) {
  return (...args) => {
    return new Promise((resolve, reject) => {
      fn(...args, (err, data) => {
        if (err) {
          reject(err)
        } else {
          resolve(data)
        }
      })
    })
  }
}
