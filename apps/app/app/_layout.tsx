import 'react-native-gesture-handler';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { SyncStatusProvider } from '@/features/sync-status';

export default function RootLayout() {
  return (
    <SyncStatusProvider>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: true }} />
    </SyncStatusProvider>
  );
}
