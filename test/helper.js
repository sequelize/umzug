'use strict';

var fs = require('fs');

module.exports = {
  clearMigrations: function () {
    var files = fs.readdirSync(__dirname + '/tmp');

    files.forEach(function (file) {
      if (file.match(/\.js$/)) {
        fs.unlinkSync(__dirname + '/tmp/' + file);
      }
    });
  },

  generateDummyMigration: function () {
    var path = __dirname + '/tmp/' + (+new Date()) + '-migration.js';
    fs.writeFileSync(path, '');
  }
};
