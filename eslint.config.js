module.exports = [
  ...require('eslint-plugin-mmkal').recommendedFlatConfigs,
  {ignores: ['lib/**', 'examples/**', 'test/generated/**']}, //
]
