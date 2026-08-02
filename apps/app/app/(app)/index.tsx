import { StyleSheet, Text, View } from 'react-native';

import { t } from '@/i18n';

/** Home — map + hierarchical entry list (DESIGN §8). Stubs until later layers. */
export default function HomeScreen() {
  return (
    <View style={styles.root}>
      <View style={styles.mapPlaceholder} accessibilityLabel={t('home.stubMap')}>
        <Text style={styles.mapLabel}>{t('home.stubMap')}</Text>
      </View>
      <View style={styles.list}>
        <Text style={styles.title}>{t('home.title')}</Text>
        <Text style={styles.tab}>{t('home.entriesTab')}</Text>
        <Text style={styles.empty}>{t('home.empty')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f4f4f5',
  },
  mapPlaceholder: {
    height: 200,
    backgroundColor: '#d4d4d8',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  mapLabel: {
    color: '#3f3f46',
    textAlign: 'center',
  },
  list: {
    flex: 1,
    padding: 16,
    gap: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#18181b',
  },
  tab: {
    fontSize: 14,
    fontWeight: '500',
    color: '#52525b',
  },
  empty: {
    fontSize: 16,
    color: '#71717a',
    marginTop: 8,
  },
});
