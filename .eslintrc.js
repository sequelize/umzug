module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 2018, sourceType: 'module', project: './tsconfig.json' },
  plugins: [
    '@typescript-eslint/eslint-plugin',
    'prettier',
    'unicorn',
  ],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:unicorn/recommended',
    'xo',
  ],
  ignorePatterns: ['lib', 'node_modules'],
  globals: { __dirname: true, process: true },
  rules: {
    'prettier/prettier': [
      'warn',
      {
        singleQuote: true,
        semi: true,
        arrowParens: 'avoid',
        trailingComma: 'es5',
        bracketSpacing: true,
        endOfLine: 'auto',
        printWidth: 120,
        useTabs: true,
      },
    ],

    'prefer-arrow-callback': 'error',
    'prefer-const': 'error',
    'no-var': 'error',
    strict: ['error', 'never'],

    '@typescript-eslint/prefer-function-type': 'error',
    '@typescript-eslint/restrict-template-expressions': 'error',
    "@typescript-eslint/no-unused-vars": ["error", {
      varsIgnorePattern: '^_',
      argsIgnorePattern: '^_',
      caughtErrorsIgnorePattern: '^_',
      ignoreRestSiblings: true,
      args: 'after-used',
    }],

    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-explicit-any': 'off',

    // xo defaults that overlap with prettier
    'comma-dangle': 'off',
    'object-curly-spacing': 'off',
    'operator-linebreak': 'off',
    'no-mixed-spaces-and-tabs': 'off',

    // covered by `@typescript-eslint/no-unsued-vars`
    'no-unused-vars': 'off',

    'no-warning-comments': 'off',
    'no-dupe-class-members': 'off',

    'unicorn/prevent-abbreviations': 'off',
    'unicorn/consistent-function-scoping': 'off',

    // for backwards compatibility, allow legacy filenames to survive.
    // consider forcing a change for next major version though.
    'unicorn/filename-case': 'off',
  },
};
