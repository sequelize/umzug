import { expect } from 'chai';
import helper from '../helper';
import Storage from '../../src/storages/sequelize';
import Sequelize from 'sequelize';

describe('sequelize', function () {
  beforeEach(function() {
    helper.clearTmp();

    this.storagePath = __dirname + '/../tmp/storage.sqlite';
    this.sequelize   = new Sequelize('database', 'username', 'password', {
      dialect: 'sqlite',
      storage: this.storagePath,
      logging: false
    });
  });

  describe('constructor', function () {
    it('requires a "sequelize" or "model" storage option', function() {
      expect(() => {
        new Storage();
      }).to.throw('One of "sequelize" or "model" storage option is required');
    });

    it('stores needed options', function () {
      var storage = new Storage({ sequelize: this.sequelize });
      expect(storage).to.have.property('sequelize')
      expect(storage).to.have.property('model');
      expect(storage).to.have.property('columnName')
    });

    it('accepts a "sequelize" option and creates a model', function () {
      var storage = new Storage({ sequelize: this.sequelize });
      expect(storage.model).to.equal(
        this.sequelize.model('SequelizeMeta')
      );
      expect(storage.model.getTableName()).to.equal(
        'SequelizeMeta'
      );
      return storage.model.sync()
        .then((model) => {
          return model.describe();
        })
        .then((description) => {
          expect(description).to.have.all.keys(['name']);
          expect(description.name.type).to.eql('VARCHAR(255)');
          // expect(description.name.defaultValue).to.be.oneOf([null, undefined])
          if (description.name.defaultValue !== undefined) {
            expect(description.name.defaultValue).to.eql(null);
          }
          expect(description.name.primaryKey).to.be.ok;
        });
    });

    it('accepts a "modelName" option', function () {
      var storage = new Storage({
        sequelize: this.sequelize,
        modelName: 'CustomModel'
      });
      expect(storage.model).to.equal(
        this.sequelize.model('CustomModel')
      );
      expect(storage.model.getTableName()).to.equal(
        'CustomModels'
      );
    });

    it('accepts a "tableName" option', function () {
      var storage = new Storage({
        sequelize: this.sequelize,
        tableName: 'CustomTable'
      });
      expect(storage.model).to.equal(
        this.sequelize.model('SequelizeMeta')
      );
      expect(storage.model.getTableName()).to.equal(
        'CustomTable'
      );
    });

    it('accepts a "columnName" option', function () {
      var storage = new Storage({
        sequelize: this.sequelize,
        columnName: 'customColumn'
      });
      return storage.model.sync()
        .then((model) => {
          return model.describe();
        })
        .then((description) => {
          expect(description).to.have.all.keys(['customColumn']);
        });
    });

    it('accepts a "timestamps" option', function () {
      var storage = new Storage({
        sequelize: this.sequelize,
        timestamps: true
      });
      return storage.model.sync()
        .then((model) => {
          return model.describe();
        })
        .then((description) => {
          expect(description).to.have.all.keys(['name','createdAt','updatedAt']);
        });
    });

    it('accepts a "columnType" option', function () {
      var storage = new Storage({
        sequelize: this.sequelize,
        columnType: new Sequelize.STRING(190)
      });
      return storage.model.sync()
        .then((model) => {
          return model.describe();
        })
        .then((description) => {
          expect(description.name.type).to.eql('VARCHAR(190)');
          // expect(description.name.defaultValue).to.be.oneOf([null, undefined])
          if (description.name.defaultValue !== undefined) {
            expect(description.name.defaultValue).to.eql(null);
          }
          expect(description.name.primaryKey).to.eql(true);
        });
    });

    it('accepts a "model" option', function () {
      var Model = this.sequelize.define('CustomModel', {
        columnName: {
          type: Sequelize.STRING
        },
        someOtherColumn: {
          type: Sequelize.INTEGER
        }
      });

      var storage = new Storage({
        model: Model
      });
      expect(storage.model).to.equal(Model);
    });
  });

  describe('logMigration', function () {
    it('creates the table if it doesn\'t exist yet', function () {
      var storage = new Storage({
        sequelize: this.sequelize
      });

      return storage.model.sequelize.getQueryInterface().showAllTables()
        .then((allTables) => {
          expect(allTables).to.be.empty;
        })
        .then(() => {
          return storage.logMigration('asd.js');
        })
        .then(() => {
          return storage.model.sequelize.getQueryInterface().showAllTables();
        })
        .then((allTables) => {
          expect(allTables).to.eql(['SequelizeMeta']);
        });
    });

    it('writes the migration to the database', function () {
      var storage = new Storage({
        sequelize: this.sequelize
      });

      return storage.logMigration('asd.js')
        .then(() => {
          return storage.model.findAll();
        })
        .then((migrations) => {
          expect(migrations.length).to.be.eql(1);
          expect(migrations[0].name).to.be.eql('asd.js');
        });
    });

    it('writes the migration to the database with a custom column name', function () {
      var storage = new Storage({
        sequelize: this.sequelize,
        columnName: 'customColumnName'
      });

      return storage.logMigration('asd.js')
        .then(() => {
          return storage.model.findAll();
        })
        .then((migrations) => {
          expect(migrations.length).to.be.eql(1);
          expect(migrations[0].customColumnName).to.be.eql('asd.js');
        });
    });

    it('writes the migration to the database with timestamps', function () {
      var storage = new Storage({
        sequelize: this.sequelize,
        timestamps: true
      });

      // Sequelize | startTime | createdAt | endTime
      // <= v2     | .123      | .000      | .456
      // >= v3     | .123      | .345      | .456
      // Sequelize <= v2 doesn't store milliseconds in timestamps so comparing
      // it to startTime with milliseconds fails. That's why we ignore
      // milliseconds in startTime too.
      var startTime = new Date(Math.floor(Date.now() / 1000) * 1000);

      return storage.logMigration('asd.js')
        .then(() => {
          return storage.model.findAll();
        })
        .then((migrations) => {
          expect(migrations.length).to.be.eql(1);
          expect(migrations[0].name).to.be.eql('asd.js');
          expect(migrations[0].createdAt).to.be.within(startTime, new Date());
        });
    });
  });

  describe('unlogMigration', function () {
    it('creates the table if it doesn\'t exist yet', function () {
      var storage = new Storage({ sequelize: this.sequelize });

      return storage.model.sequelize.getQueryInterface().showAllTables()
        .then((allTables) => {
          expect(allTables).to.be.empty;
        })
        .then(() => {
          return storage.unlogMigration('asd.js');
        })
        .then(() => {
          return storage.model.sequelize.getQueryInterface().showAllTables();
        })
        .then((allTables) => {
          expect(allTables).to.eql(['SequelizeMeta']);
        });
    });

    it('deletes the migration from the database', function () {
      var storage = new Storage({ sequelize: this.sequelize });

      return storage.logMigration('asd.js')
        .then(() => {
          return storage.model.findAll();
        })
        .then((migrations) => {
          expect(migrations.length).to.be.eql(1);
        })
        .then(() => {
          return storage.unlogMigration('asd.js');
        })
        .then(() => {
          return storage.model.findAll();
        })
        .then((migrations) => {
          expect(migrations).to.be.empty;
        });
    });

    it('deletes only the passed migration', function () {
      var storage = new Storage({ sequelize: this.sequelize });

      return storage.logMigration('migration1.js')
        .then(() => { return storage.logMigration('migration2.js'); })
        .then(() => { return storage.unlogMigration('migration2.js'); })
        .then(() => { return storage._model().findAll(); })
        .then((migrations) => {
          expect(migrations.length).to.be.eql(1);
          expect(migrations[0].name).to.equal('migration1.js');
        });
    });

    it('deletes the migration from the database with a custom column name', function () {
      var storage = new Storage({
        sequelize: this.sequelize,
        columnName: 'customColumnName'
      });

      return storage.logMigration('asd.js')
        .then(() => {
          return storage.model.findAll();
        })
        .then((migrations) => {
          expect(migrations.length).to.be.eql(1);
        })
        .then(() => {
          return storage.unlogMigration('asd.js');
        })
        .then(() => {
          return storage.model.findAll();
        })
        .then((migrations) => {
          expect(migrations).to.be.empty;
        });
    });

    it('deletes the migration from the database with timestamps', function () {
      var storage = new Storage({
        sequelize: this.sequelize,
        timestamps: true
      });

      return storage.logMigration('asd.js')
        .then(() => {
          return storage.model.findAll();
        })
        .then((migrations) => {
          expect(migrations.length).to.be.eql(1);
        })
        .then(() => {
          return storage.unlogMigration('asd.js');
        })
        .then(() => {
          return storage.model.findAll();
        })
        .then((migrations) => {
          expect(migrations).to.be.empty;
        });
    });

  });

  describe('executed', function () {
    it('creates the table if it doesn\'t exist yet', function () {
      var storage = new Storage({
        sequelize: this.sequelize
      });

      return storage.model.sequelize.getQueryInterface().showAllTables()
        .then((allTables) => {
          expect(allTables).to.be.empty;
        })
        .then(() => {
          return storage.executed();
        })
        .then(() => {
          return storage.model.sequelize.getQueryInterface().showAllTables();
        })
        .then((allTables) => {
          expect(allTables).to.eql(['SequelizeMeta']);
        });
    });

    it('returns an empty array if no migrations were logged yet', function () {
      var storage = new Storage({
        sequelize: this.sequelize
      });

      return storage.executed()
        .then((migrations) => {
          expect(migrations).to.be.empty;
        });
    });

    it('returns executed migrations', function () {
      var storage = new Storage({
        sequelize: this.sequelize
      });

      return storage.logMigration('asd.js')
        .then(() => {
          return storage.executed();
        })
        .then((migrations) => {
          expect(migrations).to.be.eql(['asd.js']);
        });
    });

    it('returns executed migrations with a custom column name', function () {
      var storage = new Storage({
        sequelize: this.sequelize,
        columnName: 'customColumnName'
      });

      return storage.logMigration('asd.js')
        .then(() => {
          return storage.executed();
        })
        .then((migrations) => {
          expect(migrations).to.be.eql(['asd.js']);
        });
    });

    it('returns executed migrations with timestamps', function () {
      var storage = new Storage({
        sequelize: this.sequelize,
        timestamps: true
      });

      return storage.logMigration('asd.js')
        .then(() => {
          return storage.executed();
        })
        .then((migrations) => {
          expect(migrations).to.be.eql(['asd.js']);
        });
    });
  });
});
