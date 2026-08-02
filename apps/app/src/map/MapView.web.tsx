import { Map } from 'maplibre-gl';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import 'maplibre-gl/dist/maplibre-gl.css';

import { MapAttribution } from './MapAttribution';
import { getMapStyleUrl } from './styleUrl';

type MapViewProps = {
  style?: object;
};

export function MapView({ style }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const map = new Map({
      container,
      style: getMapStyleUrl(),
      center: [0, 20],
      zoom: 1.2,
      attributionControl: {
        compact: false,
        customAttribution: '© OpenStreetMap contributors',
      },
    });

    return () => {
      map.remove();
    };
  }, []);

  return (
    <View style={[styles.root, style]} testID="locus-map">
      <div
        ref={containerRef}
        style={styles.canvas}
        data-testid="maplibre-canvas"
      />
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
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
});
