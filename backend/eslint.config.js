// @ts-check
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules'] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      globals: globals.node,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      'no-console': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
    },
  },
  {
    // core/ is the framework-agnostic library: no web, DB or CLI imports allowed.
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'express',
                'express-*',
                'helmet',
                'cors',
                'pino-http',
                'swagger-*',
                'drizzle-orm',
                'drizzle-orm/*',
                'pg',
              ],
              message: 'core/ must stay free of web and database dependencies.',
            },
            {
              group: ['**/api/**', '**/db/**', '**/cli/**', '**/action/**'],
              message: 'core/ must not import from api/, db/, cli/ or action/.',
            },
          ],
        },
      ],
    },
  },
  { files: ['**/*.js'], ...tseslint.configs.disableTypeChecked },
  prettier,
);
