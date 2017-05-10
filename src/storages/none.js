import Storage from './Storage';

module.exports = Storage;

console.warn(
  'Deprecated: Storage\'s (former none storage) filename has changed!',
  'Use \'umzug/lib/storages/Storage\' instead of \'umzug/lib/storages/none\'',
  'For more information: https://github.com/sequelize/umzug/pull/139',
);
