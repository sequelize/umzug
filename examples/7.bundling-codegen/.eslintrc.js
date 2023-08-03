module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
	parserOptions: {
		ecmaVersion: 2018,
		sourceType: 'module',
		project: ['./tsconfig.json'],
	},
  plugins: ['codegen'],
  ignorePatterns: ['.eslintrc.js', 'migrate.js'],
  rules: {
    'codegen/codegen': 'error',
  }
}
