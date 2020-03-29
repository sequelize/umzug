const { readFileSync } = require('fs');
const { resolve } = require('path');

const sql = readFileSync(resolve(__dirname, '../sql/2.things.sql'), 'utf8');
export const up = ({ sequelize }) => sequelize.query(sql);
