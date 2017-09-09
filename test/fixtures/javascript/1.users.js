import { readFileSync } from 'fs'
const sql = readFileSync(__dirname + '/../sql/1.users.sql', 'utf8');
export const up = ({ sequelize }) => sequelize.query(sql);
