import { expect } from 'chai';
import Umzug, { Migration } from '../../src/index';
import sinon from 'sinon';
import helper from '../helper';

describe('constructor', () => {
  beforeEach(() => {
    helper.clearTmp();
  });

  it('exposes Migration class', () => {
    expect(Migration).to.exist;
  });

  it('exposes some methods', () => {
    const umzug = new Umzug();

    expect(umzug).to.have.property('execute');
    expect(umzug).to.have.property('pending');
    expect(umzug).to.have.property('up');
    expect(umzug).to.have.property('down');
    expect(umzug).to.have.property('log');
  });

  it('instantiates the default storage', () => {
    const umzug = new Umzug();
    expect(umzug).to.have.property('storage');
  });

  it('loads the specified storage module', () => {
    const umzug = new Umzug({ storage: 'lodash' });
    expect(umzug).to.have.property('storage');
  });

  it('uses passed storage object', () => {
    class CustomStorage {
      logMigration () {}
      unlogMigration () {}
      executed () {}
    }

    const storage = new CustomStorage();
    const umzug = new Umzug({ storage });
    expect(umzug).to.have.property('storage');
    expect(umzug.storage).to.eql(storage);
  });

  it('throws an error if the specified storage is neither a package nor a file', () => {
    expect(() => {
      new Umzug({ storage: 'nomnom' });
    }).to.throw(
      'Unable to resolve the storage: nomnom, Error: Cannot find module \'nomnom\''
    );
  });

  it('accepts a logging function', () => {
    const spy = sinon.spy();
    const umzug = new Umzug({ logging: spy });
    umzug.log();
    expect(spy.called).to.be.true;
  });
});
