import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { hasSession } from '@/auth';
import { hasServerUrl, hydrateServerUrl } from '@/config/server-url';
import { t } from '@/i18n';

/**
 * Gate: server URL precedes login (DESIGN §8). No instance host is baked in.
 * An existing session skips the auth screens without wiping local data.
 */
export default function Index() {
  const router = useRouter();
  const [message, setMessage] = useState(t('common.loading'));

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await hydrateServerUrl();
      if (!hasServerUrl()) {
        if (!cancelled) router.replace('/server-setup');
        return;
      }
      try {
        if (await hasSession()) {
          if (!cancelled) router.replace('/(app)');
          return;
        }
      } catch {
        // Secure storage unavailable — fall through to login.
        if (!cancelled) setMessage(t('common.loading'));
      }
      if (!cancelled) router.replace('/(auth)/login');
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <View style={styles.root} testID="boot-gate">
      <ActivityIndicator color="#18181b" />
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#f4f4f5',
  },
  message: {
    fontSize: 16,
    color: '#52525b',
  },
});
