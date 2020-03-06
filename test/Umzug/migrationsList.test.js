import { expect } from 'chai';
import Umzug from '../../src';
import { join } from 'path';
import migrationsList from '../../src/migrationsList';
import helper from '../helper';

describe('migrationsList', () => {
  beforeEach(() => {
    helper.clearTmp();
  });

  it('test migrationsList', async () => {
    let upped = false;
    let downed = false;
    const migrations = migrationsList([{
      name: '00',
      up: async () => {
        upped = true;
      },
      down: async () => {
        downed = true;
      },
    }]);
    const umzug = new Umzug({
      migrations,
      storageOptions: { path: join(__dirname, '/../tmp/umzug.json') },
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
