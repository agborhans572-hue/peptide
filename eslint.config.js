import eslint from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'preview/**',
      'public/assets/**',
      'src/*Data.json',
      'src/productDetailData/**',
      'src/productDetailData.json',
      'src/shopData.js',
      'src/coaLibraryData.json',
      'server/catalog.generated.json',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{js,jsx}', 'scripts/**/*.mjs', 'vite.config.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  {
    files: ['netlify/functions/**/*.ts', 'server/**/*.ts'],
    languageOptions: { globals: globals.node },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['netlify/edge-functions/**/*.js'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['scripts/*.k6.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { __ENV: 'readonly', console: 'readonly' },
    },
  },
]
