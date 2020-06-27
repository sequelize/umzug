module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: 'module',
    project: ['./tsconfig.json', 'test/tsconfig.json'],
  },
  plugins: [
    '@typescript-eslint/eslint-plugin',
    'prettier',
    'unicorn',
    'jest',
    'import',
    'codegen',
  ],
  env: { 'jest/globals': true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:unicorn/recommended',
    'plugin:import/typescript',
    'plugin:jest/recommended',
    'xo',
    'xo-typescript',
  ],
  ignorePatterns: ['lib', 'node_modules', 'test/generated', 'test/fixtures/javascript', 'coverage'],
  globals: { __dirname: true, process: true },
  rules: {
    'codegen/codegen': 'warn',
    'prettier/prettier': ['error',require('./.prettierrc')],

    'prefer-arrow-callback': 'error',
    'prefer-const': 'error',
    'no-var': 'error',
    'strict': ['error', 'never'],

    'jest/expect-expect': [
      'error',
      {assertFunctionNames: ['expect', 'expectTypeOf', 'verify']}
    ],

    '@typescript-eslint/prefer-function-type': 'error',
    '@typescript-eslint/restrict-template-expressions': 'error',
    '@typescript-eslint/no-unused-vars': ['error', {
      varsIgnorePattern: '^_',
      argsIgnorePattern: '^_',
      caughtErrorsIgnorePattern: '^_',
      ignoreRestSiblings: true,
      args: 'after-used',
    }],

    'capitalized-comments': ['warn', 'always', {
      ignorePattern: 'todo',
      ignoreConsecutiveComments: true
    }],

    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/prefer-readonly-parameter-types': 'off',	
    '@typescript-eslint/no-unsafe-member-access': 'off',	
    '@typescript-eslint/no-unsafe-call': 'off',	
    '@typescript-eslint/unified-signatures': 'off',
    '@typescript-eslint/no-empty-function': 'off',

    // xo defaults that overlap with prettier
    'comma-dangle': 'off',
    'object-curly-spacing': 'off',
    'operator-linebreak': 'off',
    'no-mixed-spaces-and-tabs': 'off',
    '@typescript-eslint/indent': 'off',
    '@typescript-eslint/member-delimiter-style': 'off',
    '@typescript-eslint/quotes': 'off',

    // covered by `@typescript-eslint/no-unsued-vars`
    'no-unused-vars': 'off',

    'no-warning-comments': 'off',
    'no-dupe-class-members': 'off',
    'capitalized-comments': 'off',

    'unicorn/prevent-abbreviations': 'off',
    'unicorn/consistent-function-scoping': 'off',
  },
  overrides: [{
    files: ['test/*.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-return': 'off'
    }
  }]
};
