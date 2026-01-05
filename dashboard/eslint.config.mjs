// @ts-check

import prettier from '@vue/eslint-config-prettier'
import imports from 'eslint-plugin-import'
import unusedImports from 'eslint-plugin-unused-imports'

import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt([
  prettier,
  {
    plugins: {
      imports: imports,
      'unused-imports': unusedImports,
    },
    rules: {
      'no-undef': 'off', // Handled by TypeScript.
      'max-len': ['warn', 100, 2],
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-dynamic-delete': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/restrict-template-expressions': 'off',
      'imports/no-unresolved': 'off',
      'imports/order': ['warn', { 'newlines-between': 'always', alphabetize: { order: 'asc' } }],
      'unused-imports/no-unused-imports': 'warn',
      'vue/attributes-order': ['warn', { alphabetical: true }],
      'vue/block-order': ['warn', { order: ['script', 'template', 'style'] }],
      'vue/multi-word-component-names': 'off',
      'vue/no-setup-props-destructure': 'off',
      'vue/no-template-shadow': 'off',
      'vue/require-default-prop': 'off',
      'vue/static-class-names-order': 'warn',
    },
  },
])
