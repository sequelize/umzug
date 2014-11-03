'use strict';

var expect   = require('expect.js');
var Migrator = require('../index');

describe('Migrator', function () {
  describe('constructor', function () {
    it('exposes some methods', function () {
      var migrator = new Migrator();

      expect(migrator).to.have.property('execute');
      expect(migrator).to.have.property('pending');
      expect(migrator).to.have.property('up');
      expect(migrator).to.have.property('down');
    });
  });
});
