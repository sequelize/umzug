'use strict';

var _        = require('lodash');
var Bluebird = require('bluebird');
var fs       = require('fs');

var helper = module.exports = {
  clearTmp: function () {
    var files = fs.readdirSync(__dirname + '/tmp');

    files.forEach(function (file) {
      if (file.match(/\.(js|json|sqlite)$/)) {
        fs.unlinkSync(__dirname + '/tmp/' + file);
      }
    });
  },

  generateDummyMigration: function (name) {
    fs.writeFileSync(
      __dirname + '/tmp/' + name + '.js',
      [
        '\'use strict\';',
        '',
        'module.exports = {',
        '  up: function () {},',
        '  down: function () {}',
        '};'
      ].join('\n')
    );

    return name;
  },

  prepareMigrations: function (count, options) {
    options = _.assign({
      names: []
    }, options || {});

    return new Bluebird(function (resolve) {
      var names = options.names;
      var num   = 0;

      helper.clearTmp();

      _.times(count, function (i) {
        num++;
        names.push(options.names[i] || (num + '-migration'));
        helper.generateDummyMigration(options.names[i]);
      });

      resolve(names);
    });
  },

  wrapStorageAsCustomThenable: function(storage) {
    return {
      logMigration: function(migration) {
        return helper._convertPromiseToThenable(storage.logMigration(migration));
      },
      unlogMigration: function(migration) {
        return helper._convertPromiseToThenable(storage.unlogMigration(migration));
      },
      executed: function() {
        return helper._convertPromiseToThenable(storage.executed());
      }
    };
  },

  _convertPromiseToThenable: function(promise) {
    return {
      then: function(onFulfilled, onRejected) {
        //note don't return anything!
        promise.then(onFulfilled, onRejected);
      }
    };
  }
};
