import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { t } from '@/i18n';

const LINKS = [
  { href: '/(app)/settings/profile', labelKey: 'settings.profile' },
  { href: '/(app)/settings/security', labelKey: 'settings.security' },
  { href: '/(app)/settings/invites', labelKey: 'settings.invites' },
  { href: '/(app)/settings/tags', labelKey: 'settings.tags' },
  { href: '/(app)/settings/notifications', labelKey: 'settings.notifications' },
  { href: '/(app)/settings/storage', labelKey: 'settings.storage' },
  { href: '/(app)/settings/sync', labelKey: 'settings.sync' },
  { href: '/(app)/settings/trash', labelKey: 'settings.trash' },
] as const;

export default function SettingsIndexScreen() {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>{t('settings.title')}</Text>
      {LINKS.map((link) => (
        <Link key={link.href} href={link.href} style={styles.link}>
          {t(link.labelKey)}
        </Link>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    padding: 24,
    gap: 12,
    backgroundColor: '#f4f4f5',
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: '#18181b',
    marginBottom: 8,
  },
  link: {
    fontSize: 16,
    color: '#1d4ed8',
    paddingVertical: 4,
  },
});
