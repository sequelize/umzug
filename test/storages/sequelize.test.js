'use strict';

var _         = require('lodash');
var Bluebird  = require('bluebird');
var expect    = require('expect.js');
var helper    = require('../helper');
var Storage   = require('../../lib/storages/sequelize');
var Sequelize = require('sequelize');

describe('storages', function () {

  beforeEach(function() {
    this.sequelize = new Sequelize('database', 'username', 'password', {
      dialect: 'sqlite',
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
            expect(description).to.only.have.keys([
              'id',
              'name',
              'createdAt',
              'updatedAt'
            ]);
            expect(description.name).to.eql({
              type: 'VARCHAR(255)',
              allowNull: false,
              defaultValue: null,
              primaryKey: false
            });
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
            expect(description).to.only.have.keys([
              'id',
              'customColumn',
              'createdAt',
              'updatedAt'
            ]);
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

        return storage.options.storageOptions.model.describe()
          .catch(function(error) {
            expect(error).to.match(/No description found for "SequelizeMeta" table/);
          })
          .then(function() {
            return storage.logMigration('asd.js');
          })
          .then(function() {
            return storage.options.storageOptions.model.describe();
          })
          .then(function(description) {
            expect(description).to.have.keys(['id', 'name']);
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
          storageOptions: {
            sequelize: this.sequelize
          }
        });

        return storage.options.storageOptions.model.describe()
          .catch(function(error) {
            expect(error).to.match(/No description found for "SequelizeMeta" table/);
          })
          .then(function() {
            return storage.unlogMigration('asd.js');
          })
          .then(function() {
            return storage.options.storageOptions.model.describe();
          })
          .then(function(description) {
            expect(description).to.have.keys(['id', 'name']);
          });
      });

      it('deletes the migration from the database', function () {

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

        return storage.options.storageOptions.model.describe()
          .catch(function(error) {
            expect(error).to.match(/No description found for "SequelizeMeta" table/);
          })
          .then(function() {
            return storage.executed();
          })
          .then(function() {
            return storage.options.storageOptions.model.describe();
          })
          .then(function(description) {
            expect(description).to.have.keys(['id', 'name']);
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
