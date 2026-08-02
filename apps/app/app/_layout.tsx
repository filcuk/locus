import 'react-native-gesture-handler';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { DatabaseProvider } from '@/db/DatabaseProvider';
import { SyncStatusProvider } from '@/features/sync-status';

export default function RootLayout() {
  return (
    <DatabaseProvider>
      <SyncStatusProvider>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: true }} />
      </SyncStatusProvider>
    </DatabaseProvider>
  );
}
