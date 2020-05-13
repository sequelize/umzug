const { readFileSync } = require('fs');
const { resolve } = require('path');

const sql = readFileSync(resolve(__dirname, '../sql/1.users.sql'), 'utf8');
const up = ({ sequelize }) => sequelize.query(sql);

module.exports = { up };
