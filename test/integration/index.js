const chai = require('chai');
const expect = chai.expect;

describe('integration Tests', () => {
  it('lib can be required', () => {
    const lib = require('../../lib');
    expect(lib).to.be.a('function');
    expect(lib.name).equal('Umzug');
  });
});
