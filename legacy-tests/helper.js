const _ = require('lodash');
const jetpack = require('fs-jetpack').cwd(__dirname);

const helper = module.exports = {
  clearTmp (path) {
    const tmpPath = jetpack.path('tmp');
    path = path || tmpPath;
    const files = jetpack.list(path);

    files.forEach((file) => {
      const filePath = jetpack.path(path, file);
      if (file.match(/\.(js|json|sqlite)$/)) {
        try {
          jetpack.remove(filePath);
        } catch (e) {
        }
      } else if (jetpack.exists(filePath) === 'dir') {
        helper.clearTmp(filePath);
      }
    });
    if (path !== tmpPath) {
      jetpack.remove(path);
    }
  },

  generateDummyMigration(name, subDirectories, options = {}) {
    let path = jetpack.path('tmp');
    if (subDirectories) {
      if (!_.isArray(subDirectories)) {
        subDirectories = [subDirectories];
      }
      subDirectories.forEach((directory) => {
        path = jetpack.path(path, directory);
        jetpack.dir(path);
      });
    }
    jetpack.write(
      jetpack.path(path, name + '.js'),
      [
        '\'use strict\';',
        '',
        'module.exports = {',
        `  up: function () { return ${options.returnUndefined ? 'undefined' : 'Promise.resolve()'}; },`,
        `  down: function () { return ${options.returnUndefined ? 'undefined' : 'Promise.resolve()'}; }`,
        '};',
      ].join('\n'),
    );

    return name;
  },

  prepareMigrations (count, options) {
    options = {
      names: [],
      directories: [], // can be array of strings or array of array of strings
      // example 1: ['foo','bar'] ==> generates /foo and /bar
      // example 2: [['foo','bar'],['foo','bar2']] ==> generates /foo/bar and /foo/bar2
      // example 3: ['foo',['foo','bar2']] ==> generates /foo and /foo/bar2
      ...options || {},
    };
    const { returnUndefined } = options;

    return new Promise((resolve) => {
      const names = options.names;
      let num = 0;

      helper.clearTmp();

      _.times(count, (i) => {
        num++;
        names.push(options.names[i] || (num + '-migration'));
        helper.generateDummyMigration(names[i], options.directories[i], { returnUndefined });
      });

      resolve(names);
    });
  },

  wrapStorageAsCustomThenable (storage) {
    return {
      logMigration (migration) {
        return helper._convertPromiseToThenable(storage.logMigration(migration));
      },
      unlogMigration (migration) {
        return helper._convertPromiseToThenable(storage.unlogMigration(migration));
      },
      executed () {
        return helper._convertPromiseToThenable(storage.executed());
      },
    };
  },

  _convertPromiseToThenable (promise) {
    return {
      then (onFulfilled, onRejected) {
        // note don't return anything!
        promise.then(onFulfilled, onRejected);
      },
    };
  },

  promisify (fn) {
    return (...args) => new Promise((resolve, reject) => {
      fn(...args, (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    });
  },
};
