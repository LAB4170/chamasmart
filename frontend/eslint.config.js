import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^(motion$|[A-Z_])', args: 'none', caughtErrors: 'none' }],
    },
  },
  {
    // Context files export a provider and its hook together; that is deliberate here.
    files: ['src/context/**/*.{js,jsx}'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  {
    // Unit tests are written for Jest; they are linted with Jest globals. No test runner is configured yet.
    files: ['src/__tests__/**/*.{js,jsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.jest, require: 'readonly' } },
  },
])
