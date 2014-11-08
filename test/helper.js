'use strict';

var _        = require('lodash');
var Bluebird = require('bluebird');
var fs       = require('fs');

var helper = module.exports = {
  clearMigrations: function () {
    var files = fs.readdirSync(__dirname + '/tmp');

    files.forEach(function (file) {
      if (file.match(/\.(js|json)$/)) {
        fs.unlinkSync(__dirname + '/tmp/' + file);
      }
    });
  },

  generateDummyMigration: function (name) {
    name = name || ~~(Math.random() * 9999) + '-migration';

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
    options = _.extend({
      names: []
    }, options || {});

    var names = [];

    return new Bluebird(function (resolve) {
      helper.clearMigrations();

      for (var i = 0; i < count; i++) {
        names.push(helper.generateDummyMigration(options.names[i]));
      }

      resolve(names);
    });
  }
};
