import { Sequelize as SequelizeType, Model as ModelClass } from 'sequelize';

interface ModelTempInterface extends ModelClass {
	[key: string]: any
}

type ModelType = typeof ModelClass & {
	new (values?: object, options?: any): ModelTempInterface;
}

export { SequelizeType, ModelType };
