exports.up = async ({ context: { sequelize, DataTypes } }) => {
	await sequelize.getQueryInterface().createTable('roles', {
		id: {
			type: DataTypes.INTEGER,
			allowNull: false,
			primaryKey: true,
		},
		name: {
			type: DataTypes.STRING,
			allowNull: false,
		},
	});
};

exports.down = async ({ context: { sequelize } }) => {
	await sequelize.getQueryInterface().dropTable('roles');
};
