module.exports = {
  root: true,
  env: {
    node: true,
  },
  extends: [
    'plugin:vue/vue3-essential',
    '@vue/airbnb',
  ],
  parserOptions: {
    parser: '@babel/eslint-parser',
    requireConfigFile: false,
  },
  rules: {
    'no-console': 'off',
    'no-debugger': 'off',
    'vue/multi-word-component-names': 'off',
    'vue/html-closing-bracket-spacing': 'off',
    'vue/html-indent': 'off',
    'vue/html-self-closing': 'off',
    'vue/max-attributes-per-line': 'off',
    'vue/first-attribute-linebreak': 'off',
    'vue/no-template-target-blank': 'off',
    'vue/object-curly-spacing': 'off',
    'vuejs-accessibility/alt-text': 'off',
    'vuejs-accessibility/form-control-has-label': 'off',
    'vuejs-accessibility/click-events-have-key-events': 'off',
    'import/no-unresolved': 'off',
    'function-paren-newline': 'off',
  },
};
