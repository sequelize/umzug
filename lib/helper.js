'use strict';

var resolve = require('resolve').sync;

module.exports = {
  resolve: function (packageName) {
    var result;

    try {
      result = resolve(packageName, { basedir: process.cwd() });
      result = require(result);
    } catch (e) {
      try {
        result = require(packageName);
      } catch (e) {}
    }

    return result;
  }
};
