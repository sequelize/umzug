const tseslint = require('typescript-eslint')
const codegen = require('eslint-plugin-codegen')

module.exports = [
  tseslint.configs.base,
  {plugins: {codegen}},
  {files: ['migrations/*.ts']},
  {rules: {'codegen/codegen': 'error'}},
]
