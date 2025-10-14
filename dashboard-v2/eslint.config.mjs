// @ts-check

import eslint from '@eslint/js'
import prettier from '@vue/eslint-config-prettier'
import { defineConfig } from 'eslint/config'
import imports from 'eslint-plugin-import'
import unusedImports from 'eslint-plugin-unused-imports'
import vue from 'eslint-plugin-vue'
import globals from 'globals'
import typescript from 'typescript-eslint'

export default defineConfig([
  eslint.configs.recommended,
  typescript.configs.recommended,
  ...vue.configs['flat/recommended'],
  prettier,
  imports.flatConfigs.recommended,
  {
    ignores: ['**/.*', './node_modules/**/*', './dist/**/*'],
  },
  {
    plugins: {
      'unused-imports': unusedImports,
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.browser,
      parserOptions: {
        parser: typescript.parser,
      },
    },
    rules: {
      'max-len': ['warn', 100, 2],
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/restrict-template-expressions': 'off',
      'import/order': ['error', { 'newlines-between': 'always', alphabetize: { order: 'asc' } }],
      'import/no-unresolved': 'off',
      'unused-imports/no-unused-imports': 'error',
      'vue/attributes-order': ['warn', { alphabetical: true }],
      'vue/multi-word-component-names': 'off',
      'vue/no-setup-props-destructure': 'off',
      'vue/no-template-shadow': 'off',
      'vue/static-class-names-order': 'warn',
    },
  },
])
