'use strict';

var _         = require('lodash');
var Bluebird  = require('bluebird');
var path      = require('path');
var redefine  = require('redefine');

/**
 * Sequelize storage
 *
 * Stores migration in a database table using Sequelize.  One of "sequelize" or
 * "model" storage option is required.
 *
 * If "sequelize" option is supplied will create a model named "SequelizeMeta" with
 * timestamps and an attribute "name" for storing migrations.  The model name,
 * table name, and column name are customizable with options.
 *
 * If "model" option is supplied will use existing model for storing migrations.
 * The model must have an attribute "name", which can be customized.
 *
 * If the table does not exist it will be created automatically.
 *
 * @param {Object} [options]
 * @param {Object} [options.storageOptions]
 * @param {Object} [options.storageOptions.sequelize] configured instance of Sequelize
 * @param {Object} [options.storageOptions.model] Sequelize model - must have column
 * name matching "columnName" option
 * @param {String} [options.storageOptions.modelName='SequelizeMeta'] name of model
 * to create if "model" option is not supplied
 * @param {String} [options.storageOptions.tableName=modelName] name of table
 * to create if "model" option is not supplied
 * @param {String} [options.storageOptions.columnName='name'] name of table column
 * holding migration name
 * @param {String} [options.storageOptions.columnType=Sequelize.STRING] type of the column
 * For utf8mb4 charsets under InnoDB, you may need to set this <= 190
 */
module.exports = redefine.Class({
  constructor: function (options) {
    this.options = options || {};
    this.options.storageOptions = _.assign({
      // note 'sequelize' or 'model' is required
      modelName: 'SequelizeMeta',
      // note 'tableName' (optional) also supported
      columnName: 'name'
    }, this.options.storageOptions || {});

    if (!this.options.storageOptions.model && !this.options.storageOptions.sequelize) {
      throw new Error('One of "sequelize" or "model" storage option is required');
    }

    // initialize model
    if (!this.options.storageOptions.model) {
      var sequelize = this.options.storageOptions.sequelize;
      var modelName = this.options.storageOptions.modelName;
      var Sequelize = sequelize.constructor;
      var columnType = this.options.storageOptions.columnType || Sequelize.STRING;

      if (sequelize.isDefined(modelName)) {
        this.options.storageOptions.model = sequelize.model(modelName);
      } else {
        var attributes = {};

        attributes[this.options.storageOptions.columnName] = {
          type: columnType,
          allowNull: false,
          unique: true,
          primaryKey: true,
          autoIncrement: false
        };

        this.options.storageOptions.model = sequelize.define(
          modelName,
          attributes,
          {
            tableName:  this.options.storageOptions.tableName,
            timestamps: false
          }
        );
      }
    }

  },

  logMigration: function (migrationName) {
    var self = this;

    return this._model()
      .sync()
      .then(function(Model) {
        var migration = {};
        migration[self.options.storageOptions.columnName] = migrationName;
        return Model.create(migration);
      });
  },

  unlogMigration: function (migrationName) {
    var self             = this;
    var sequelize        = this.options.storageOptions.sequelize;
    var sequelizeVersion = !!sequelize.modelManager ? 2 : 1;

    return this._model()
      .sync()
      .then(function(Model) {
        var where = {};
        where[self.options.storageOptions.columnName] = migrationName;

        if (sequelizeVersion > 1) {
          // This is an ugly hack to find out which function signature we have to use.
          where = { where: where };
        }

        return Model.destroy(where);
      });
  },

  executed: function () {
    var self = this;

    return this._model()
      .sync()
      .then(function(Model) {
        return Model.findAll();
      })
      .then(function(migrations) {
        return migrations.map(function(migration) {
          return migration[self.options.storageOptions.columnName];
        });
      });
  },

  _model: function () {
    return this.options.storageOptions.model;
  }
});
