import SequelizeStorage from './SequelizeStorage';

module.exports = SequelizeStorage;

console.warn(
  'Deprecated: SequelizeStorage\'s filename has changed!',
  'Use \'umzug/lib/storages/SequelizeStorage\' instead of \'umzug/lib/storages/sequelize\'',
  'For more information: https://github.com/sequelize/umzug/pull/139',
);
