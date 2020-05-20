exports.up = ({ sequelize }) => sequelize.query(`
  CREATE TABLE thing (
    id INTEGER PRIMARY KEY,
    name VARCHAR,
    ownerId INTEGER REFERENCES user(id)
  );
`);
