var resolve = require('resolve').sync;

module.exports = {
  resolve: function (package) {
    var result;

    try {
      result = resolve(package, { basedir: process.cwd() });
      result = require(result);
    } catch (e) {
      try {
        result = require(package);
      } catch (e) {}
    }

    return result;
  }
}
