import { StyleSheet, Text, View } from 'react-native';

import { t } from '@/i18n';
import { MapView } from '@/map';

export default function MapScreen() {
  return (
    <View style={styles.root} testID="map-screen">
      <Text style={styles.title}>{t('map.title')}</Text>
      <MapView style={styles.map} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f4f4f5',
  },
  title: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 20,
    fontWeight: '600',
    color: '#18181b',
  },
  map: {
    flex: 1,
  },
});
