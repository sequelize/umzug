exports.up = ({ sequelize }) => sequelize.query(`
  CREATE TABLE user (
    id INTEGER PRIMARY KEY,
    name VARCHAR
  );
`);
