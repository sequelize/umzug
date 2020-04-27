import { Sequelize as SequelizeType, Model as ModelClass } from 'sequelize';

interface ModelTempInterface extends ModelClass {
	[key: string]: any;
}

type ModelClassType = typeof ModelClass & {
	// eslint-disable-next-line @typescript-eslint/prefer-function-type
	new (values?: object, options?: any): ModelTempInterface;
};

export { SequelizeType, ModelClassType }; // eslint-disable-line no-undef
