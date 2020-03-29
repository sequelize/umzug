const { readFileSync } = require('fs');
const { resolve, join, parse } = require('path');
const { expect } = require('chai');
const Sequelize = require('sequelize');
const helper = require('../helper');
const Umzug = require('../../src');
const { v4: uuid } = require('uuid');
const Migration = require('../../src/migration');

describe('custom resolver', () => {
  beforeEach(function () {
    helper.clearTmp();
    this.storagePath = join(__dirname, `/../tmp/storage-${uuid()}.sqlite`);
    this.sequelize = new Sequelize('database', 'username', 'password', {
      dialect: 'sqlite',
      storage: this.storagePath,
      logging: false,
    });

    this.umzug = () => {
      if (!this.path || !this.pattern) {
        throw new Error('path and pattern must be defined');
      }
      return new Umzug({
        migrations: {
          path: this.path,
          params: [
            this.sequelize.getQueryInterface(),
            this.sequelize.constructor,
          ],
          pattern: this.pattern,
          customResolver: this.customResolver,
          nameFormatter: (path) => parse(path).name,
        },
        storage: 'sequelize',
        storageOptions: {
          path: this.storagePath,
          sequelize: this.sequelize,
        },
      });
    };

    this.verifyTables = async () => {
      const tables = await this.sequelize.query(
        'select * from sqlite_master where type=\'table\'',
        { type: Sequelize.QueryTypes.SHOWTABLES }
      );

      expect(tables.sort()).to.deep.equal(['SequelizeMeta', 'thing', 'user']);
    };
    this.verifyMeta = async () => {
      const [meta] = await this.sequelize.query('select * from `SequelizeMeta`');

      expect(meta).to.deep.equal([ { name: '1.users' }, { name: '2.things' } ]);
    };
  });

  it('resolves javascript files if no custom resolver is defined', async function () {
    this.pattern = /\.js$/;
    this.path = resolve(__dirname, 'javascript');
    this.customResolver = undefined;

    await this.umzug().up();

    await this.verifyTables();
    await this.verifyMeta();
  });

  it('an array of migrations created manually can be passed in', async function () {
    const umzug = new Umzug({
      migrations: [
        new Migration(require.resolve('./javascript/1.users'), {
          upName: 'up',
          downName: 'down',
          migrations: {
            wrap: fn => () => fn(this.sequelize.getQueryInterface(), this.sequelize.constructor),
            nameFormatter: (path) => parse(path).name,
          },
        }),
        new Migration(require.resolve('./javascript/2.things'), {
          upName: 'up',
          downName: 'down',
          migrations: {
            wrap: fn => () => fn(this.sequelize.getQueryInterface(), this.sequelize.constructor),
            nameFormatter: (path) => parse(path).name,
          },
        }),
      ],
      storage: 'sequelize',
      storageOptions: {
        path: this.storagePath,
        sequelize: this.sequelize,
      },
    });

    await umzug.up();

    await this.verifyTables();
    await this.verifyMeta();
  });

  it('can resolve sql files', async function () {
    this.pattern = /\.sql$/;
    this.path = resolve(__dirname, 'sql');
    this.customResolver = path => ({
      up: () => this.sequelize.query(readFileSync(path, 'utf8')),
    });

    await this.umzug().up();

    await this.verifyTables();
    await this.verifyMeta();
  });
});
