import { UmzugStorage } from './type-helpers/umzug-storage';
import { SequelizeType, ModelClassType } from './type-helpers/sequelize-type-helpers';
import { SetRequired } from 'type-fest';

interface _SequelizeStorageConstructorOptions {
	/**
	The configured instance of Sequelize. If omitted, it is inferred from the `model` option.
	*/
	readonly sequelize?: SequelizeType;

	/**
	The model representing the SequelizeMeta table. Must have a column that matches the `columnName` option. If omitted, it is created automatically.
	*/
	readonly model?: any;

	/**
	The name of the model.

	@default 'SequelizeMeta'
	*/
	readonly modelName?: string;

	/**
	The name of the table. If omitted, defaults to the model name.
	*/
	readonly tableName?: string;

	/**
	Name of the schema under which the table is to be created.

	@default undefined
	*/
	readonly schema?: any;

	/**
	Name of the table column holding the executed migration names.

	@default 'name'
	*/
	readonly columnName?: string;

	/**
	The type of the column holding the executed migration names.

	For `utf8mb4` charsets under InnoDB, you may need to set this to less than 190

	@default Sequelize.DataTypes.STRING
	*/
	readonly columnType?: any;

	/**
	Option to add timestamps to the table

	@default false
	*/
	readonly timestamps?: boolean;
}

export type SequelizeStorageConstructorOptions =
	SetRequired<_SequelizeStorageConstructorOptions, 'sequelize'> |
	SetRequired<_SequelizeStorageConstructorOptions, 'model'>;

export class SequelizeStorage implements UmzugStorage {
	public readonly sequelize: SequelizeType;
	public readonly columnType: string;
	public readonly columnName: string;
	public readonly timestamps: boolean;
	public readonly modelName: string;
	public readonly tableName: string;
	public readonly schema: any;
	public readonly model: ModelClassType;

	/**
	Constructs Sequelize based storage. Migrations will be stored in a SequelizeMeta table using the given instance of Sequelize.

	If a model is given, it will be used directly as the model for the SequelizeMeta table. Otherwise, it will be created automatically according to the given options.

	If the table does not exist it will be created automatically upon the logging of the first migration.
	*/
	constructor(options: SequelizeStorageConstructorOptions) {
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

	getModel(): ModelClassType {
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
					autoIncrement: false
				}
			},
			{
				tableName: this.tableName,
				schema: this.schema,
				timestamps: this.timestamps,
				charset: 'utf8',
				collate: 'utf8_unicode_ci'
			}
		) as ModelClassType;
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

	async executed(): Promise<string[]> {
		await this.model.sync();
		const migrations: any[] = await this.model.findAll({ order: [[this.columnName, 'ASC']] });
		return migrations.map(migration => {
			const name = migration[this.columnName];
			if (typeof name !== 'string') {
				throw new TypeError(`Unexpected migration name type: expected string, got ${typeof name}`);
			}

			return name;
		});
	}

	// TODO remove this
	_model(): ModelClassType {
		return this.model;
	}
}
