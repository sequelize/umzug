import _ from 'lodash';
import fs from 'fs';
import {join} from 'path';

const helper = module.exports = {
  clearTmp () {
    let files = fs.readdirSync(join(__dirname, '/tmp'));

    files.forEach((file) => {
      if (file.match(/\.(js|json|sqlite|coffee)$/)) {
        fs.unlinkSync(join(__dirname, '/tmp/', file));
      }
    });
  },

  generateDummyMigration (name) {
    fs.writeFileSync(
      join(__dirname, '/tmp/' + name + '.js'),
      [
        '\'use strict\';',
        '',
        'module.exports = {',
        '  up: function () {},',
        '  down: function () {}',
        '};',
      ].join('\n')
    );

    return name;
  },

  prepareMigrations (count, options) {
    options = {
      names: [],
      ...options || {},
    };

    return new Promise((resolve) => {
      let names = options.names;
      let num = 0;

      helper.clearTmp();

      _.times(count, (i) => {
        num++;
        names.push(options.names[i] || (num + '-migration'));
        helper.generateDummyMigration(options.names[i]);
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
    return (...args) => {
      return new Promise((resolve, reject) => {
        fn(...args, (err, data) => {
          if (err) {
            reject(err);
          } else {
            resolve(data);
          }
        });
      });
    };
  },
};
