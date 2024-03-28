module.exports = [
  ...require('eslint-plugin-mmkal').recommendedFlatConfigs,
  {ignores: ['lib/**', 'examples/**', 'test/generated/**']}, //
  {
    rules: {
      // todo[>=4.0.0] drop lower node version support and remove these
      'unicorn/prefer-string-replace-all': 'off',
      'unicorn/prefer-at': 'off',
    },
  },
]
