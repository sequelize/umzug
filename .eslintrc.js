module.exports = {
	parser: '@typescript-eslint/parser',
	parserOptions: {
		ecmaVersion: 2018,
		sourceType: 'module',
		project: ['./tsconfig.eslint.json'],
	},
	plugins: ['@typescript-eslint/eslint-plugin', 'prettier', 'unicorn', 'jest', 'import', 'codegen'],
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
		'prettier/prettier': ['warn', require('./.prettierrc')],

		'prefer-arrow-callback': 'error',
		'prefer-const': 'error',
		'no-console': 'warn',
		'no-var': 'error',
		strict: ['error', 'never'],

		'no-await-in-loop': 'off',

		'jest/expect-expect': ['error', { assertFunctionNames: ['expect', 'expectTypeOf', 'verify'] }],

		'@typescript-eslint/ban-types': 'off',
		'@typescript-eslint/ban-ts-comment': [
			'warn',
			{
				'ts-expect-error': 'allow-with-description',
				'ts-ignore': 'allow-with-description', // even with description, prefer-ts-expect-error still applies
			},
		],
		'@typescript-eslint/prefer-function-type': 'error',
		'@typescript-eslint/restrict-template-expressions': 'error',
		'@typescript-eslint/no-shadow': 'error',
		'@typescript-eslint/no-unused-vars': [
			'error',
			{
				varsIgnorePattern: '^_',
				argsIgnorePattern: '^_',
				caughtErrorsIgnorePattern: '^_',
				ignoreRestSiblings: true,
				args: 'after-used',
			},
		],

		'unicorn/import-style': [
			'warn',
			{
				styles: {
					path: { default: false, namespace: true },
				},
			},
		],

		'@typescript-eslint/explicit-function-return-type': 'off',
		'@typescript-eslint/no-explicit-any': 'off',
		'@typescript-eslint/prefer-readonly-parameter-types': 'off',
		'@typescript-eslint/no-unsafe-member-access': 'off',
		'@typescript-eslint/member-ordering': 'off',
		'@typescript-eslint/no-unsafe-call': 'off',
		'@typescript-eslint/unified-signatures': 'off',
		'@typescript-eslint/no-empty-function': 'off',

		// xo defaults that overlap with prettier
		'comma-dangle': 'off',
		'object-curly-spacing': 'off',
		'operator-linebreak': 'off',
		'no-mixed-spaces-and-tabs': 'off',
		'@typescript-eslint/comma-dangle': 'off',
		'@typescript-eslint/indent': 'off',
		'@typescript-eslint/quotes': 'off',
		'@typescript-eslint/semi': 'off',

		// covered by `@typescript-eslint/no-unsued-vars`
		'no-unused-vars': 'off',

		'no-warning-comments': 'off',
		'no-dupe-class-members': 'off',
		'capitalized-comments': 'off',

		'unicorn/catch-error-name': 'off',
		'unicorn/consistent-function-scoping': 'off',
		'unicorn/expiring-todo-comments': 'warn',
		'unicorn/no-fn-reference-in-iterator': 'off',
		'unicorn/no-null': 'off',
		'unicorn/prevent-abbreviations': 'off',
	},
	overrides: [
		{
			files: ['test/**/*.ts'],
			rules: {
				'@typescript-eslint/no-unsafe-return': 'off',
				'@typescript-eslint/no-non-null-assertion': 'off',
			},
		},
	],
};
