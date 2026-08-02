import type { ExpoConfig } from 'expo/config';

/**
 * User-supplied icons/splash are not present yet (assets rule).
 * Expo falls back until the maintainer provides artwork.
 */
const config: ExpoConfig = {
  name: 'Locus',
  slug: 'locus',
  scheme: 'locus',
  version: '0.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  web: {
    bundler: 'metro',
    output: 'single',
  },
  plugins: ['expo-dev-client', 'expo-router'],
  experiments: {
    typedRoutes: true,
  },
  android: {
    package: 'app.locus',
  },
  extra: {
    // Never a production instance URL — empty until the user configures one.
    defaultServerUrl: '',
  },
};

export default config;
