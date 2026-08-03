import { StyleSheet, Text, View } from 'react-native';

import { t } from '@/i18n';

import type { EntryTagChip } from './useEntryTagChips';

export function TagChipsRow({ chips }: { chips: EntryTagChip[] }) {
  if (chips.length === 0) {
    return (
      <Text style={styles.empty} testID="entry-tags-empty">
        {t('entry.detail.tagsEmpty')}
      </Text>
    );
  }

  return (
    <View style={styles.row} testID="entry-tags">
      {chips.map((chip) => (
        <View
          key={chip.id}
          style={[
            styles.chip,
            chip.colour ? { backgroundColor: chip.colour } : null,
          ]}
          testID={`entry-tag-${chip.id}`}
        >
          <Text style={styles.chipText}>
            {chip.namespace ? `${chip.namespace}:${chip.label}` : chip.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#e4e4e7',
  },
  chipText: { fontSize: 13, color: '#18181b', fontWeight: '500' },
  empty: { color: '#71717a', fontSize: 14 },
});
