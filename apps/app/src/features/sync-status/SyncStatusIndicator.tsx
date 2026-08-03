import { StyleSheet, Text, View } from 'react-native';

import { t, type MessageKey } from '@/i18n';

import type { SyncIndicatorState } from './types';

const LABEL_KEY: Record<SyncIndicatorState, MessageKey> = {
  offline: 'syncStatus.offline',
  syncing: 'syncStatus.syncing',
  live: 'syncStatus.live',
  error: 'syncStatus.error',
  idle: 'syncStatus.idle',
};

const DOT: Record<SyncIndicatorState, string> = {
  offline: '#a1a1aa',
  syncing: '#2563eb',
  live: '#16a34a',
  error: '#dc2626',
  idle: '#71717a',
};

type Props = {
  state: SyncIndicatorState;
  /** Optional detail for Error (not shown as raw exception text in chrome). */
  errorDetail?: string | null;
};

/** Compact chrome chip — Offline / Syncing / Live / Error (+ quiet Online idle). */
export function SyncStatusIndicator({ state, errorDetail }: Props) {
  const label = t(LABEL_KEY[state]);
  const a11y =
    state === 'error' && errorDetail !== null && errorDetail !== undefined && errorDetail.length > 0
      ? `${label}: ${errorDetail}`
      : label;

  return (
    <View
      testID="sync-status"
      accessibilityRole="text"
      accessibilityLabel={a11y}
      style={[styles.chip, state === 'error' ? styles.chipError : null]}
    >
      <View testID={`sync-status-dot-${state}`} style={[styles.dot, { backgroundColor: DOT[state] }]} />
      <Text testID="sync-status-label" style={styles.label}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(244, 244, 245, 0.92)',
  },
  chipError: {
    backgroundColor: 'rgba(254, 226, 226, 0.95)',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#18181b',
  },
});
