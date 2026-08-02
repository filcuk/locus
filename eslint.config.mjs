import tseslint from 'typescript-eslint';

const noFetchOutsideSync =
  'Network I/O in apps/app belongs to the sync driver and photo upload queue under src/sync. Components read WatermelonDB observables instead (AGENTS §4).';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/.expo/**',
      'apps/app/android/**',
      'apps/app/ios/**',
      'apps/api/drizzle/**',
    ],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    extends: [tseslint.configs.recommended],
    rules: {
      // Restated rather than inherited: AGENTS §6 makes this a CI gate, so it must
      // not weaken if the shared preset ever downgrades it.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['apps/app/**/*.ts', 'apps/app/**/*.tsx'],
    ignores: ['apps/app/src/sync/**'],
    rules: {
      'no-restricted-globals': ['error', { name: 'fetch', message: noFetchOutsideSync }],
      'no-restricted-properties': [
        'error',
        { object: 'window', property: 'fetch', message: noFetchOutsideSync },
        { object: 'globalThis', property: 'fetch', message: noFetchOutsideSync },
      ],
    },
  },
);
