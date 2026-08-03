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
  plugins: [
    'expo-dev-client',
    'expo-router',
    'expo-secure-store',
    [
      'expo-location',
      {
        // Foreground one-shot only (DESIGN §8 / §13). Never enable background.
        locationWhenInUsePermission:
          'Locus uses your location once to sort nearby places on Home.',
        isIosBackgroundLocationEnabled: false,
        isAndroidBackgroundLocationEnabled: false,
      },
    ],
    '@maplibre/maplibre-react-native',
  ],
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
