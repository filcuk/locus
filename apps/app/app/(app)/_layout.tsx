import { Redirect, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { getSessionUser } from '@/auth';
import { DatabaseProvider } from '@/db/DatabaseProvider';
import { databaseNameForScope } from '@/db/scope';
import { getServerUrl } from '@/config/server-url';
import { t } from '@/i18n';
import { SyncDriverProvider } from '@/sync';

export default function AppLayout() {
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getSessionUser().then((user) => {
      if (cancelled) return;
      setUserId(user?.id ?? null);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return (
      <View style={styles.root}>
        <ActivityIndicator color="#18181b" />
        <Text>{t('common.loading')}</Text>
      </View>
    );
  }
  const serverUrl = getServerUrl();
  if (serverUrl === null) {
    return <Redirect href="/server-setup" />;
  }
  if (userId === null) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <DatabaseProvider databaseName={databaseNameForScope(serverUrl, userId)}>
      <SyncDriverProvider>
        <Stack screenOptions={{ headerShown: true }} />
      </SyncDriverProvider>
    </DatabaseProvider>
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
});
