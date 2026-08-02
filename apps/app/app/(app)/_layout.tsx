import { Redirect, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { hasSession } from '@/auth';
import { t } from '@/i18n';

export default function AppLayout() {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void hasSession().then((ok) => {
      if (cancelled) return;
      setSignedIn(ok);
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
  if (!signedIn) {
    return <Redirect href="/(auth)/login" />;
  }

  return <Stack screenOptions={{ headerShown: true }} />;
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
