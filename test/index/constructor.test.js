'use strict';

var expect    = require('expect.js');
var Umzug     = require('../../index');
var sinon     = require('sinon');
var helper    = require('../helper');

describe('constructor', function () {
  it('exposes some methods', function () {
    var umzug = new Umzug();

    expect(umzug).to.have.property('execute');
    expect(umzug).to.have.property('pending');
    expect(umzug).to.have.property('up');
    expect(umzug).to.have.property('down');
    expect(umzug).to.have.property('log');
  });

  it('instantiates the default storage', function () {
    var umzug = new Umzug();
    expect(umzug).to.have.property('storage');
  });

  it('loads the specified storage module', function () {
    var umzug = new Umzug({ storage: 'moment' });
    expect(umzug).to.have.property('storage');
  });

  it('throws an error if the specified storage is neither a package nor a file', function () {
    expect(function () {
      new Umzug({ storage: 'nomnom' });
    }).to.throwError(
      'Unable to resolve the storage: nomnom, Error: Cannot find module \'nomnom\''
    );
  });

  it('accepts a logging function', function () {
    var spy = sinon.spy();
    var umzug = new Umzug({ logging: spy });
    umzug.log();
    expect(spy.called).to.be(true);
  });

  it('can accept multiple directories for migrations', function() {
    let umzug;
    return helper.prepareMigrations(2, { names: ['1111-migration', '../tmp2/234-migration'] })
    .then(() => {
      umzug = new Umzug({
          migrations:     { path: [__dirname + '/../tmp/', __dirname + '/../tmp2/'] },
          storageOptions: { path: __dirname + '/../tmp/umzug.json' },
          logging:        this.logSpy
        });
      return umzug._findMigrations()
    }).then((migrationsFound) => {
      expect(migrationsFound.length).to.be(2)
    })
  })

});
