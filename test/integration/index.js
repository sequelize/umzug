const chai = require('chai');
const expect = chai.expect;

describe('integration Tests', function () {
  it('lib can be required', function () {
    const lib = require('../../lib');
    expect(lib).to.be.a('function');
    expect(lib.name).equal('Umzug');
  });
});
