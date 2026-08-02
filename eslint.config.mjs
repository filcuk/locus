import tseslint from 'typescript-eslint';

const noFetchOutsideOwners =
  'Network I/O in apps/app belongs to src/auth, src/sync, and the photo upload queue. Components read WatermelonDB observables instead (AGENTS §4).';

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
    ignores: ['apps/app/src/sync/**', 'apps/app/src/auth/**'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: noFetchOutsideOwners },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'window', property: 'fetch', message: noFetchOutsideOwners },
        {
          object: 'globalThis',
          property: 'fetch',
          message: noFetchOutsideOwners,
        },
      ],
    },
  },
);
