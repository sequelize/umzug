import { Storage } from './Storage';
import { SequelizeType, ModelType } from './type-helpers/sequelize-type-helpers';
import { SetRequired } from 'type-fest';

interface _SequelizeStorageConstructorOptions {
	/**
	 * The configured instance of Sequelize.
	 */
	readonly sequelize?: SequelizeType;

	/** The model representing the SequelizeMeta table. Must have a column
	 * that matches the `columnName` option. If omitted, it is created automatically.
	 */
	readonly model?: any;

	/**
	 * The name of the model. If omitted, defaults to "SequelizeMeta"
	 */
	readonly modelName?: string;

	/**
	 * The name of the table. If omitted, defaults to the model name.
	 */
	readonly tableName?: string;

	/**
	 * Name of the schema under which the table is to be created.
	 * Defaults to `undefined`.
	 */
	readonly schema?: any;

	/**
	 * Name of the table column holding the executed migration names.
	 */
	readonly columnName?: string;

	/**
	 * The type of the column holding the executed migration names. For utf8mb4 charsets
	 * under InnoDB, you may need to set this <= 190. Defaults to `Sequelize.DataTypes.STRING`.
	 */
	readonly columnType?: any;

	/**
	 * Option to add timestamps to the table
	 */
	readonly timestamps?: boolean;
}

export type SequelizeStorageConstructorOptions =
	SetRequired<_SequelizeStorageConstructorOptions, 'sequelize'> |
	SetRequired<_SequelizeStorageConstructorOptions, 'model'>;

/**
 * @class SequelizeStorage
 */
export class SequelizeStorage extends Storage {
	public readonly sequelize: SequelizeType;
	public readonly columnType: string;
	public readonly columnName: string;
	public readonly timestamps: boolean;
	public readonly modelName: string;
	public readonly tableName: string;
	public readonly schema: any;
	public readonly model: ModelType;

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
	 */
	constructor(options: SequelizeStorageConstructorOptions) {
		super();

		if (!options || (!options.model && !options.sequelize)) {
			throw new Error('One of "sequelize" or "model" storage option is required');
		}

		this.sequelize = options.sequelize ?? options.model.sequelize;
		this.columnType = options.columnType ?? (this.sequelize.constructor as any).STRING;
		this.columnName = options.columnName ?? 'name';
		this.timestamps = options.timestamps ?? false;
		this.modelName = options.modelName ?? 'SequelizeMeta';
		this.tableName = options.tableName;
		this.schema = options.schema;
		this.model = options.model ?? this.getModel();
	}

	getModel(): ModelType {
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
		) as ModelType;
	}

	async logMigration(migrationName: string): Promise<void> {
		await this.model.sync();
		await this.model.create({
			[this.columnName]: migrationName
		});
	}

	async unlogMigration(migrationName: string): Promise<void> {
		await this.model.sync();
		await this.model.destroy({
			where: {
				[this.columnName]: migrationName
			}
		});
	}

	/**
	 * Gets list of executed migrations.
	 */
	async executed(): Promise<string[]> {
		await this.model.sync();
		const migrations = await this.model.findAll({ order: [[ this.columnName, 'ASC' ]] });
		return migrations.map(migration => migration[this.columnName]);
	}

	_model(): ModelType {
		return this.model;
	}
}
