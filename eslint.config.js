import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        window: 'readonly', document: 'readonly', console: 'readonly',
        localStorage: 'readonly', requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly', setTimeout: 'readonly',
        clearTimeout: 'readonly', setInterval: 'readonly', clearInterval: 'readonly',
        performance: 'readonly', Blob: 'readonly', URL: 'readonly',
        FileReader: 'readonly', AudioContext: 'readonly', alert: 'readonly',
        confirm: 'readonly', HTMLCanvasElement: 'readonly'
      }
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }]
    }
  }
];
