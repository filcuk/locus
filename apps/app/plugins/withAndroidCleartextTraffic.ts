/**
 * Allow plain-HTTP instance URLs on Android (LAN self-host / DEVELOPMENT pitfalls).
 * ExpoConfig's Android type in SDK 57 does not expose usesCleartextTraffic; set it
 * on the manifest via the config-plugins API instead.
 */

import {
  AndroidConfig,
  withAndroidManifest,
  type ConfigPlugin,
} from 'expo/config-plugins';

export const withAndroidCleartextTraffic: ConfigPlugin = (config) =>
  withAndroidManifest(config, (mod) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(
      mod.modResults,
    );
    application.$['android:usesCleartextTraffic'] = 'true';
    return mod;
  });

export default withAndroidCleartextTraffic;
