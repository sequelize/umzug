const tseslint = require('typescript-eslint')
const codegen = require('eslint-plugin-codegen')

module.exports = [
  tseslint.configs.base,
  {plugins: {codegen}},
  {rules: {'codegen/codegen': 'error'}},
  {files: ['migrations/*.ts']},
  {ignores: ['dist/**']},
]
