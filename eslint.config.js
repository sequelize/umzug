module.exports = [
  ...require('eslint-plugin-mmkal').recommendedFlatConfigs,
  {ignores: ['lib/**', 'examples/**', 'test/generated/**']}, //
  {
    rules: {
      // todo[>=4.0.0] drop lower node versions support and remove this
      'unicorn/prefer-string-replace-all': 'off', // still supporting node 12 :(
    },
  },
]
