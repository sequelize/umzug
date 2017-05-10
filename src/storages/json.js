import JSONStorage from './JSONStorage';

module.exports = JSONStorage;

console.warn(
  'Deprecated: JSONStorage\'s filename has changed!',
  'Use \'umzug/lib/storages/JSONStorage\' instead of \'umzug/lib/storages/json\'',
  'For more information: https://github.com/sequelize/umzug/pull/139',
);
