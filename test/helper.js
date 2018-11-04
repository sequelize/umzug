import fs from 'fs';
import { join } from 'path';

const helper = module.exports = {
  clearTmp (path) {
    const tmpPath = join(__dirname, '/tmp');
    path = path || tmpPath;
    const files = fs.readdirSync(path);

    files.forEach((file) => {
      const filePath = join(path, '/' + file);
      if (file.match(/\.(js|json|sqlite|coffee)$/)) {
        fs.unlinkSync(filePath);
      } else if (fs.lstatSync(filePath).isDirectory()) {
        helper.clearTmp(filePath);
      }
    });
    if (path !== tmpPath) {
      fs.rmdirSync(path);
    }
  },

  generateDummyMigration (name, subDirectories) {
    let path = join(__dirname, '/tmp/');
    if (subDirectories) {
      if (!Array.isArray(subDirectories)) {
        subDirectories = [subDirectories];
      }
      subDirectories.forEach((directory) => {
        path = join(path, directory + '/');
        if (!fs.existsSync(path)) {
          fs.mkdirSync(path);
        }
      });
    }
    fs.writeFileSync(
      join(path, name + '.js'),
      [
        '\'use strict\';',
        '',
        'module.exports = {',
        '  up () {},',
        '  down () {}',
        '};',
      ].join('\n')
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

    return new Promise((resolve) => {
      const names = options.names;

      helper.clearTmp();

      for (let i = 0; i < count; ++i) {
        names.push(options.names[i] || ((i + 1) + '-migration'));
        helper.generateDummyMigration(names[i], options.directories[i]);
      }
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
