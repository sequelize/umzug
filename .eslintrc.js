module.exports = {
	parser: '@typescript-eslint/parser',
	parserOptions: {
		ecmaVersion: 2018,
		sourceType: 'module',
		project: ['./tsconfig.json'],
		extraFileExtensions: ['.md', '.mjs'],
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
	ignorePatterns: ['lib', 'node_modules', 'test/generated', 'test/fixtures/javascript', 'coverage', 'examples/**/*.md'],
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
		// not a good rule because nullish coalescing is a worse option for strings: https://github.com/typescript-eslint/typescript-eslint/issues/4906
		'@typescript-eslint/prefer-nullish-coalescing': 'off',
		// gets it wrong for subclasses of subclasses of `Error`
		'@typescript-eslint/no-throw-literal': 'off',

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
		'@typescript-eslint/object-curly-spacing': 'off',

		// nice-to-haves, require some refactoring/tweaking of rules
		'@typescript-eslint/naming-convention': 'off',
		'@typescript-eslint/no-require-imports': 'off',
		'unicorn/prefer-node-protocol': 'off',
		'unicorn/prefer-module': 'off',

		// defaults from configs/plugins that overlap with prettier
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
		'no-promise-executor-return': 'off',

		// unicorn over-reaching, IMHO
		'unicorn/catch-error-name': 'off',
		'unicorn/consistent-function-scoping': 'off',
		'unicorn/expiring-todo-comments': 'warn',
		'unicorn/no-fn-reference-in-iterator': 'off',
		'unicorn/no-null': 'off',
		'unicorn/prevent-abbreviations': 'off',
		'unicorn/no-useless-undefined': 'off',
		'unicorn/prefer-spread': 'off',
		'unicorn/no-await-expression-member': 'off',
		'unicorn/no-array-for-each': 'off',
	},
	overrides: [
		{
			files: ['test/**/*.ts'],
			rules: {
				'@typescript-eslint/no-unsafe-return': 'off',
				'@typescript-eslint/no-non-null-assertion': 'off',
				'@typescript-eslint/no-unsafe-assignment': 'off',
				'@typescript-eslint/consistent-type-imports': 'off',
			},
		},
		{
			files: ['examples/**/*.{cjs,mjs,js,ts}'],
			rules: {
				'@typescript-eslint/no-unused-vars': 'off',
				'unicorn/filename-case': 'off',
				'no-console': 'off',
				'@typescript-eslint/no-floating-promises': 'off',
				'@typescript-eslint/no-var-requires': 'off',
				'@typescript-eslint/no-unsafe-return': 'off',
				'@typescript-eslint/no-non-null-assertion': 'off',
				'@typescript-eslint/no-unsafe-assignment': 'off',
			},
		},
		{
			files: ['*.md'],
			rules: {
				'prettier/prettier': 'off',
				'no-trailing-spaces': 'off',
				'no-multiple-empty-lines': 'off',
				'unicorn/filename-case': 'off',
			},
		},
	],
};
