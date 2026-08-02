import { StyleSheet, Text, View } from 'react-native';

import { getServerUrl } from '@/config/server-url';
import { t } from '@/i18n';

/** Sync settings stub — surfaces the configured server URL (never a default host). */
export default function SettingsSyncScreen() {
  const serverUrl = getServerUrl();
  return (
    <View style={styles.root} testID="settings-sync">
      <Text style={styles.title} accessibilityRole="header">
        {t('settings.sync')}
      </Text>
      <Text style={styles.body}>{t('settings.stub')}</Text>
      <Text style={styles.label}>{t('serverSetup.urlLabel')}</Text>
      <Text testID="settings-sync-url" style={styles.value}>
        {serverUrl ?? '—'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    padding: 24,
    gap: 12,
    justifyContent: 'center',
    backgroundColor: '#f4f4f5',
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: '#18181b',
  },
  body: {
    fontSize: 16,
    lineHeight: 22,
    color: '#52525b',
  },
  label: {
    marginTop: 8,
    fontSize: 13,
    color: '#71717a',
  },
  value: {
    fontSize: 16,
    color: '#18181b',
  },
});
