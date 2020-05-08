const { expect } = require('chai');
const { Umzug, JSONStorage } = require('../../lib/src');
const { join } = require('path');
const { migrationsList } = require('../../lib/src/migrationsList');
const helper = require('../helper');

describe('migrationsList', () => {
  beforeEach(() => {
    helper.clearTmp();
  });

  it('test migrationsList', async () => {
    let upped = false;
    let downed = false;
    const migrations = migrationsList([{
      name: '00',
      up: async (param) => {
        expect(param).to.equal('hello');
        upped = true;
      },
      down: async (param) => {
        expect(param).to.equal('hello');
        downed = true;
      },
    }], ['hello']);
    const umzug = new Umzug({
      migrations,
      storage: new JSONStorage({ path: join(__dirname, '/../tmp/umzug.json') }),
    });

    expect((await umzug.pending())[0].file).to.equal('00');
    expect(upped).to.equal(false);
    expect(downed).to.equal(false);
    await umzug.up();
    expect(upped).to.equal(true);
    expect(downed).to.equal(false);
    expect((await umzug.executed())[0].file).to.equal('00');
    await umzug.down();
    expect(downed).to.equal(true);
    expect((await umzug.pending())[0].file).to.equal('00');
  });
});
