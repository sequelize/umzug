'use strict';

var Bluebird  = require('bluebird');
var expect    = require('expect.js');
var helper    = require('../helper');
var Storage   = require('../../lib/storages/sequelize');
var Sequelize = require('sequelize');

describe('storages', function () {
  beforeEach(function() {
    helper.clearTmp();

    this.storagePath = __dirname + '/../tmp/storage.sqlite';
    this.sequelize   = new Sequelize('database', 'username', 'password', {
      dialect: 'sqlite',
      storage: this.storagePath,
      logging: false
    });
  });

  describe('sequelize', function () {
    describe('constructor', function () {
      it('requires a "sequelize" or "model" storage option', function() {
        expect(function() {
          new Storage();
        }).to.throwException('One of "sequelize" or "model" storage option is required');
      });

      it('stores options', function () {
        var storage = new Storage({
          storageOptions: {
            sequelize: this.sequelize
          }
        });
        expect(storage).to.have.property('options');
        expect(storage.options).to.have.property('storageOptions');
      });

      it('accepts a "sequelize" option and creates a model', function () {
        var storage = new Storage({
          storageOptions: {
            sequelize: this.sequelize
          }
        });
        expect(storage.options.storageOptions.model).to.equal(
          this.sequelize.model('SequelizeMeta')
        );
        expect(storage.options.storageOptions.model.getTableName()).to.equal(
          'SequelizeMeta'
        );
        return storage.options.storageOptions.model.sync()
          .then(function (model) {
            return model.describe();
          })
          .then(function(description) {
            expect(description).to.only.have.keys(['name']);
            expect(description.name.type).to.eql('VARCHAR(255)')
            expect(description.name.defaultValue).to.eql(null);
            expect(description.name.primaryKey).to.be.ok();
          });
      });

      it('accepts a "modelName" option', function () {
        var storage = new Storage({
          storageOptions: {
            sequelize: this.sequelize,
            modelName: 'CustomModel'
          }
        });
        expect(storage.options.storageOptions.model).to.equal(
          this.sequelize.model('CustomModel')
        );
        expect(storage.options.storageOptions.model.getTableName()).to.equal(
          'CustomModels'
        );
      });

      it('accepts a "tableName" option', function () {
        var storage = new Storage({
          storageOptions: {
            sequelize: this.sequelize,
            tableName: 'CustomTable'
          }
        });
        expect(storage.options.storageOptions.model).to.equal(
          this.sequelize.model('SequelizeMeta')
        );
        expect(storage.options.storageOptions.model.getTableName()).to.equal(
          'CustomTable'
        );
      });

      it('accepts a "columnName" option', function () {
        var storage = new Storage({
          storageOptions: {
            sequelize: this.sequelize,
            columnName: 'customColumn'
          }
        });
        return storage.options.storageOptions.model.sync()
          .then(function (model) {
            return model.describe();
          })
          .then(function(description) {
            expect(description).to.only.have.keys(['customColumn']);
          });
      });

      it('accepts a "columnType" option', function () {
        var storage = new Storage({
          storageOptions: {
            sequelize: this.sequelize,
            columnType: new Sequelize.STRING(190)
          }
        });
        return storage.options.storageOptions.model.sync()
          .then(function (model) {
            return model.describe();
          })
          .then(function(description) {
            expect(description.name.type).to.eql('VARCHAR(190)');
            expect(description.name.defaultValue).to.eql(null);
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
          storageOptions: {
            model: Model
          }
        });
        expect(storage.options.storageOptions.model).to.equal(Model);
      });
    }); //end describe('constructor', function() {

    describe('logMigration', function () {
      it("creates the table if it doesn't exist yet", function () {
        var storage = new Storage({
          storageOptions: {
            sequelize: this.sequelize
          }
        });

        return storage.options.storageOptions.model.sequelize.getQueryInterface().showAllTables()
          .then(function(allTables) {
            expect(allTables).to.be.empty();
          })
          .then(function() {
            return storage.logMigration('asd.js');
          })
          .then(function() {
            return storage.options.storageOptions.model.sequelize.getQueryInterface().showAllTables();
          })
          .then(function(allTables) {
            expect(allTables).to.eql(['SequelizeMeta']);
          });
      });

      it('writes the migration to the database', function () {
        var storage = new Storage({
          storageOptions: {
            sequelize: this.sequelize
          }
        });

        return storage.logMigration('asd.js')
          .then(function() {
            return storage.options.storageOptions.model.findAll();
          })
          .then(function(migrations) {
            expect(migrations.length).to.be(1);
            expect(migrations[0].name).to.be('asd.js');
          });
      });

      it('writes the migration to the database with a custom column name', function () {
        var storage = new Storage({
          storageOptions: {
            sequelize: this.sequelize,
            columnName: 'customColumnName'
          }
        });

        return storage.logMigration('asd.js')
          .then(function() {
            return storage.options.storageOptions.model.findAll();
          })
          .then(function(migrations) {
            expect(migrations.length).to.be(1);
            expect(migrations[0].customColumnName).to.be('asd.js');
          });
      });
    }); //end describe('logMigration', function() {

    describe('unlogMigration', function () {
      it("creates the table if it doesn't exist yet", function () {
        var storage = new Storage({
          storageOptions: { sequelize: this.sequelize }
        });

        return storage.options.storageOptions.model.sequelize.getQueryInterface().showAllTables()
          .then(function(allTables) {
            expect(allTables).to.be.empty();
          })
          .then(function() {
            return storage.unlogMigration('asd.js');
          })
          .then(function() {
            return storage.options.storageOptions.model.sequelize.getQueryInterface().showAllTables();
          })
          .then(function(allTables) {
            expect(allTables).to.eql(['SequelizeMeta']);
          });
      });

      it('deletes the migration from the database', function () {
        var storage = new Storage({
          storageOptions: { sequelize: this.sequelize }
        });

        return storage.logMigration('asd.js')
          .then(function() {
            return storage.options.storageOptions.model.findAll();
          })
          .then(function(migrations) {
            expect(migrations.length).to.be(1);
          })
          .then(function() {
            return storage.unlogMigration('asd.js');
          })
          .then(function() {
            return storage.options.storageOptions.model.findAll();
          })
          .then(function(migrations) {
            expect(migrations).to.be.empty();
          });
      });

      it('deletes only the passed migration', function () {
        var storage = new Storage({ storageOptions: { sequelize: this.sequelize } });

        return storage.logMigration('migration1.js')
          .then(function () { return storage.logMigration('migration2.js'); })
          .then(function () { return storage.unlogMigration('migration2.js'); })
          .then(function () { return storage._model().findAll(); })
          .then(function (migrations) {
            expect(migrations.length).to.be(1);
            expect(migrations[0].name).to.equal('migration1.js');
          });
      });

      it('deletes the migration from the database with a custom column name', function () {
        var storage = new Storage({
          storageOptions: {
            sequelize: this.sequelize,
            columnName: 'customColumnName'
          }
        });

        return storage.logMigration('asd.js')
          .then(function() {
            return storage.options.storageOptions.model.findAll();
          })
          .then(function(migrations) {
            expect(migrations.length).to.be(1);
          })
          .then(function() {
            return storage.unlogMigration('asd.js');
          })
          .then(function() {
            return storage.options.storageOptions.model.findAll();
          })
          .then(function(migrations) {
            expect(migrations).to.be.empty();
          });
      });

    });

    describe('executed', function () {
      it("creates the table if it doesn't exist yet", function () {
        var storage = new Storage({
          storageOptions: {
            sequelize: this.sequelize
          }
        });

        return storage.options.storageOptions.model.sequelize.getQueryInterface().showAllTables()
          .then(function(allTables) {
            expect(allTables).to.be.empty();
          })
          .then(function() {
            return storage.executed();
          })
          .then(function() {
            return storage.options.storageOptions.model.sequelize.getQueryInterface().showAllTables();
          })
          .then(function(allTables) {
            expect(allTables).to.eql(['SequelizeMeta']);
          });
      });

      it('returns an empty array if no migrations were logged yet', function () {
        var storage = new Storage({
          storageOptions: {
            sequelize: this.sequelize
          }
        });

        return storage.executed()
          .then(function (migrations) {
            expect(migrations).to.be.empty();
          });
      });

      it('returns executed migrations', function () {
        var storage = new Storage({
          storageOptions: {
            sequelize: this.sequelize
          }
        });

        return storage.logMigration('asd.js')
          .then(function() {
            return storage.executed();
          })
          .then(function(migrations) {
            expect(migrations).to.be.eql(['asd.js']);
          });
      });

      it('returns executed migrations with a custom column name', function () {
        var storage = new Storage({
          storageOptions: {
            sequelize: this.sequelize,
            columnName: 'customColumnName'
          }
        });

        return storage.logMigration('asd.js')
          .then(function() {
            return storage.executed();
          })
          .then(function(migrations) {
            expect(migrations).to.be.eql(['asd.js']);
          });
      });
    }); //end describe('executed', function() {
  }); //end describe('sequelize', function() {
}); //end describe('storages', function() {
