// ESLint configuration.
// Besides normal code-quality rules, this file ENFORCES ReqMan's module boundaries (NFR-12):
//  1. Code outside a module may import only that module's public entry (modules/<name> or modules/<name>/index).
//  2. The renderer (UI) may never import core code (main/, modules/) — it talks to the core only via window.reqman.
// A violation fails the build, so module internals stay replaceable in one place.
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'

const moduleInternals = {
  group: ['**/modules/*/*', '!**/modules/*/index', '!**/modules/*/index.ts'],
  message:
    'Import a module only through its public entry (modules/<name>). Internals are private — see docs/ARCHITECTURE.md.'
}

export default tseslint.config(
  { ignores: ['out/**', 'dist/**', 'node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.node } },
    rules: {
      'no-restricted-imports': ['error', { patterns: [moduleInternals] }]
    }
  },
  {
    // Inside a module, its own files may import each other freely.
    files: ['src/modules/**/*.ts'],
    rules: { 'no-restricted-imports': 'off' }
  },
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            moduleInternals,
            {
              group: ['**/main/**', '**/modules/**', 'electron', 'node:*', 'fs', 'child_process'],
              message: 'The UI must not use core or Node APIs directly. Call window.reqman (src/shared/api.ts) instead.'
            }
          ]
        }
      ]
    }
  }
)
