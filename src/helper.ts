/**
 * Try to require module from file relative to process cwd or regular require.
 *
 * @param {string} packageName - Filename relative to process' cwd or package
 * name to be required.
 *
 * @returns {any} Required module
 */
export function resolve(packageName): any {
	let result;

	try {
		result = require.resolve(packageName, { paths: [process.cwd()] });
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
