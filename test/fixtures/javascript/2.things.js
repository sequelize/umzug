import { readFileSync } from 'fs'
const sql = readFileSync(__dirname + '/../sql/2.things.sql', 'utf8');
export const up = ({ sequelize }) => sequelize.query(sql);
