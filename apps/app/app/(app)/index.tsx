import { StyleSheet, Text, View } from 'react-native';

import { t } from '@/i18n';
import { MapView } from '@/map';

/** Home — map + hierarchical entry list (DESIGN §8). */
export default function HomeScreen() {
  return (
    <View style={styles.root}>
      <MapView style={styles.map} />
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
  map: {
    height: 220,
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
