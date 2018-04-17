import { expect } from 'chai';
import Umzug from '../../src/index';
import sinon from 'sinon';
import helper from '../helper';

describe('constructor', function () {
  beforeEach(function () {
    helper.clearTmp();
  });

  it('exposes some methods', function () {
    let umzug = new Umzug();

    expect(umzug).to.have.property('execute');
    expect(umzug).to.have.property('pending');
    expect(umzug).to.have.property('up');
    expect(umzug).to.have.property('down');
    expect(umzug).to.have.property('log');
  });

  it('instantiates the default storage', function () {
    let umzug = new Umzug();
    expect(umzug).to.have.property('storage');
  });

  it('loads the specified storage module', function () {
    let umzug = new Umzug({ storage: 'lodash' });
    expect(umzug).to.have.property('storage');
  });

  it('uses passed storage object', function () {
    class CustomStorage {
      logMigration () {}
      unlogMigration () {}
      executed () {}
    }

    const storage = new CustomStorage();
    let umzug = new Umzug({ storage });
    expect(umzug).to.have.property('storage');
    expect(umzug.storage).to.eql(storage);
  });

  it('throws an error if the specified storage is neither a package nor a file', function () {
    expect(() => {
      new Umzug({ storage: 'nomnom' });
    }).to.throw(
      'Unable to resolve the storage: nomnom, Error: Cannot find module \'nomnom\''
    );
  });

  it('accepts a logging function', function () {
    let spy = sinon.spy();
    let umzug = new Umzug({ logging: spy });
    umzug.log();
    expect(spy.called).to.be.true;
  });

  it('converts migration options object to array', () => {
    const umzug = new Umzug({ migrations: { traverseDirectories: true } });
    expect(umzug.options.migrations).to.be.an.array;
    expect(umzug.options.migrations).to.have.length(1);
    expect(umzug.options.migrations[0].traverseDirectories).to.be.true;
  });
});
