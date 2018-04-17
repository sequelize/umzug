import { expect } from 'chai';
import helper from '../helper';
import Umzug from '../../src/index';
import { join } from 'path';

describe('_findMigrations', function () {
  beforeEach(function () {
    helper.clearTmp();
    return helper.prepareMigrations(4, {
      directories: [['one'], ['one'], ['two', '1'], ['two', '2']],
    });
  });

  it('loads files with each config', async function () {
    const umzug = new Umzug({
      migrations: [
        { path: join(__dirname, '..', 'tmp', 'one') },
        {
          path: join(__dirname, '..', 'tmp', 'two'),
          pattern: /3-migration/,
          traverseDirectories: true,
        },
      ],
    });
    const migrations = await umzug._findMigrations();
    expect(migrations).to.have.length(3);
    expect(migrations.map(m => m.file)).to.eql([
      '1-migration.js',
      '2-migration.js',
      '3-migration.js',
    ]);
  });
});
