import Storage from './Storage';

/**
 * @class SequelizeStorage
 */
export default class SequelizeStorage extends Storage {
  /**
   * Constructs Sequelize based storage.
   *
   * Stores migration in a database table using Sequelize. One of "sequelize" or
   * "model" storage option is required.
   *
   * If "sequelize" option is supplied will create a model named "SequelizeMeta"
   * with timestamps and an attribute "name" for storing migrations. The model
   * name, table name, and column name are customizable with options.
   *
   * If "model" option is supplied will use existing model for storing
   * migrations. The model must have an attribute "name", which can be
   * customized.
   *
   * If the table does not exist it will be created automatically.
   *
   * @param {Object} [options]
   * @param {Object} [options.]
   * @param {Object} [options.sequelize] - configured instance of Sequelize.
   * @param {Object} [options.model] - Sequelize model - must have column name
   * matching "columnName" option.
   * @param {String} [options.modelName='SequelizeMeta'] - name of the model
   * to create if "model" option is not supplied.
   * @param {String} [options.tableName=modelName] - name of the table to create
   * if "model" option is not supplied.
   * @param {String} [options.schema=schema] - name of the schema to create
   * the table under, defaults to undefined.
   * @param {String} [options.columnName='name'] - name of the table column
   * holding migration name.
   * @param {String} [options.columnType=Sequelize.STRING] - type of the column.
   * For utf8mb4 charsets under InnoDB, you may need to set this <= 190.
   * @param {Boolean} [options.timestamps=false] - option to add timestamps to the model table
   */
  constructor ({
    sequelize,
    model,
    modelName = 'SequelizeMeta',
    tableName,
    schema,
    columnName = 'name',
    columnType,
    timestamps = false,
  } = {}) {
    super();
    if (!model && !sequelize) {
      throw new Error('One of "sequelize" or "model" storage option is required');
    }

    this.sequelize = sequelize || model.sequelize;

    const Sequelize = this.sequelize.constructor;

    this.columnType = columnType || Sequelize.STRING;
    this.columnName = columnName;
    this.timestamps = timestamps;
    this.modelName = modelName;
    this.tableName = tableName;
    this.schema = schema;
    this.model = model || this.getModel();
  }

  getModel () {
    if (this.sequelize.isDefined(this.modelName)) {
      return this.sequelize.model(this.modelName);
    }

    return this.sequelize.define(
      this.modelName,
      {
        [this.columnName]: {
          type: this.columnType,
          allowNull: false,
          unique: true,
          primaryKey: true,
          autoIncrement: false,
        },
      },
      {
        tableName: this.tableName,
        schema: this.schema,
        timestamps: this.timestamps,
        charset: 'utf8',
        collate: 'utf8_unicode_ci',
      }
    );
  }

  /**
   * Logs migration to be considered as executed.
   *
   * @param {String} migrationName - Name of the migration to be logged.
   * @returns {Promise}
   */
  logMigration (migrationName) {
    let self = this;

    return this._model()
      .sync()
      .then(function (Model) {
        let migration = {};
        migration[self.columnName] = migrationName;
        return Model.create(migration);
      });
  }

  /**
   * Unlogs migration to be considered as pending.
   *
   * @param {String} migrationName - Name of the migration to be unlogged.
   * @returns {Promise}
   */
  unlogMigration (migrationName) {
    let self = this;
    let sequelize = this.sequelize;
    let sequelizeVersion = sequelize.modelManager ? 2 : 1;

    return this._model()
      .sync()
      .then(function (Model) {
        let where = {};
        where[self.columnName] = migrationName;

        if (sequelizeVersion > 1) {
          // This is an ugly hack to find out which function signature we have to use.
          where = { where: where };
        }

        return Model.destroy(where);
      });
  }

  /**
   * Gets list of executed migrations.
   *
   * @returns {Promise.<String[]>}
   */
  executed () {
    let self = this;

    return this._model()
      .sync()
      .then(function (Model) {
        return Model.findAll({ order: [ [ self.columnName, 'ASC' ] ] });
      })
      .then(function (migrations) {
        return migrations.map(function (migration) {
          return migration[self.columnName];
        });
      });
  }

  /**
   * Gets Sequelize model used as a storage.
   *
   * @returns {Sequelize.Model}
   * @private
   */
  _model () {
    return this.model;
  }
}
