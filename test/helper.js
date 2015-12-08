'use strict';

var _         = require('lodash');
var Bluebird  = require('bluebird');
var fs        = require('fs');

var helper = module.exports = {
  clearTmp: function () {
    // empty tmp directory
    var migrations = fs.readdirSync(__dirname + '/tmp');
    migrations.forEach(function (file) {
      if (file.match(/\.(js|json|sqlite)$/)) {
        fs.unlinkSync(__dirname + '/tmp/' + file);
      }
    });

    // empty tmp/squashes directory
    var squashes = fs.readdirSync(__dirname + '/tmp/squashes');
    squashes.forEach(function (file) {
      if (file.match(/\.(js|json|sqlite)$/)) {
        fs.unlinkSync(__dirname + '/tmp/squashes/' + file);
      }
    });

    // forget all required files under tmp directory
    for (var path in require.cache) {
      if (require.cache.hasOwnProperty(path)) {
        if (path.indexOf(__dirname + '/tmp/') === 0) {
          delete require.cache[path];
        }
      }
    }
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

  generateDummySquash: function (name, migrations) {
    fs.writeFileSync(
      __dirname + '/tmp/squashes/' + name + '.js',
      [
        '\'use strict\';',
        '',
        'module.exports = {',
        '  migrations: ' + JSON.stringify(migrations) + ',',
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

      _.times(count, function (i) {
        num++;
        names.push(options.names[i] || (num + '-migration'));
        helper.generateDummyMigration(options.names[i]);
      });

      resolve(names);
    });
  },

  prepareSquashes: function (count, options) {
    options = _.assign({
      names: []
    }, options || {});

    return new Bluebird(function (resolve) {
      var names = options.names;
      var num   = 0;

      _.times(count, function (i) {
        num++;
        var name = options.names[i] || (num + '-squash');
        names.push(name);
        helper.generateDummySquash(options.names[i], options.migrations[i]);
      });

      resolve(names);
    });
  },

  prepare: function (options) {
    options = options || {};

    options.migrations = _.assign({
      count: 0
    }, options.migrations || {});

    options.squashes = _.assign({
      count: 0
    }, options.squashes|| {});

    helper.clearTmp();

    return Bluebird.join(
      helper.prepareMigrations(
        options.migrations.count,
        options.migrations.options
      ),
      helper.prepareSquashes(
        options.squashes.count,
        options.squashes.options
      )
    );
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
