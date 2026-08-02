import { Camera, Map } from '@maplibre/maplibre-react-native';
import { StyleSheet, View } from 'react-native';

import { MapAttribution } from './MapAttribution';
import { getMapStyleUrl } from './styleUrl';

type MapViewProps = {
  style?: object;
};

/**
 * Android MapLibre surface. Requires a development build and ANDROID_HOME —
 * not verifiable in this environment (see Hold card / B3 Android task).
 */
export function MapView({ style }: MapViewProps) {
  return (
    <View style={[styles.root, style]} testID="locus-map">
      <Map style={styles.canvas} mapStyle={getMapStyleUrl()} attribution logo={false}>
        <Camera initialViewState={{ center: [0, 20], zoom: 1.2 }} />
      </Map>
      <MapAttribution />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 240,
    position: 'relative',
    overflow: 'hidden',
  },
  canvas: {
    flex: 1,
  },
});
