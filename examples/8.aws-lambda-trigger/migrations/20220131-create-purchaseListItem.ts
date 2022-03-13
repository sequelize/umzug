import Sequelize from 'sequelize';

const up = async ({ context: queryInterface }) => {
  await queryInterface.createTable('TestItem', {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: Sequelize.INTEGER,
    },
    quantity: {
      type: Sequelize.INTEGER,
    },
    status: {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    createdAt: {
      allowNull: false,
      type: Sequelize.DATE,
    },
    dateUpdated: {
      allowNull: false,
      type: Sequelize.DATE,
    },
  });
};

const down = async ({ context: queryInterface }) => {
  await queryInterface.dropTable('TestItem');
};

export { up, down };
