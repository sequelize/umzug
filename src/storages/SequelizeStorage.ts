import { Storage } from './Storage';

export interface SequelizeStorageConstructorOptions {
	readonly sequelize?: any;
	readonly model?: any;
	readonly modelName?: string;
	readonly tableName?: string;
	readonly schema?: any;
	readonly columnName?: string;
	readonly columnType?: any;
	readonly timestamps?: boolean;
}

/**
 * @class SequelizeStorage
 */
export class SequelizeStorage extends Storage {
	public readonly sequelize: any;
	public readonly columnType: string;
	public readonly columnName: string;
	public readonly timestamps: boolean;
	public readonly modelName: string;
	public readonly tableName: string;
	public readonly schema: any;
	public readonly model: any;

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
	constructor (options?: SequelizeStorageConstructorOptions) {
		options = options ?? {};

		super();
		if (!options.model && !options.sequelize) {
			throw new Error('One of "sequelize" or "model" storage option is required');
		}

		this.sequelize = options.sequelize || options.model.sequelize;

		const Sequelize = this.sequelize.constructor;

		this.columnType = options.columnType || Sequelize.STRING;
		this.columnName = options.columnName ?? 'name';
		this.timestamps = options.timestamps ?? false;
		this.modelName = options.modelName ?? 'SequelizeMeta';
		this.tableName = options.tableName;
		this.schema = options.schema;
		this.model = options.model || this.getModel();
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
		const self = this;

		return this._model()
			.sync()
			.then((Model) => {
				const migration = {};
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
		const self = this;
		const sequelize = this.sequelize;
		const sequelizeVersion = sequelize.modelManager ? 2 : 1;

		return this._model()
			.sync()
			.then((Model) => {
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
		const self = this;

		return this._model()
			.sync()
			.then((Model) => Model.findAll({ order: [ [ self.columnName, 'ASC' ] ] }))
			.then((migrations) => migrations.map((migration) => migration[self.columnName]));
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
