import { StyleSheet, Text, View } from 'react-native';

import { MAP_ATTRIBUTION_TEXT } from './attribution';

/** Always-visible attribution strip — complements MapLibre's own control. */
export function MapAttribution() {
  return (
    <View
      style={styles.root}
      testID="map-attribution"
      accessibilityRole="text"
      accessibilityLabel={MAP_ATTRIBUTION_TEXT}
    >
      <Text style={styles.text}>{MAP_ATTRIBUTION_TEXT}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
  },
  text: {
    fontSize: 11,
    lineHeight: 14,
    color: '#18181b',
  },
});
