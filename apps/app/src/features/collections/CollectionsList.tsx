import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { t } from '@/i18n';

import type { CollectionListRow } from './types';

type CollectionsListProps = {
  rows: CollectionListRow[];
  loading: boolean;
};

export function CollectionsList({ rows, loading }: CollectionsListProps) {
  if (loading) {
    return <Text style={styles.meta}>{t('common.loading')}</Text>;
  }
  if (rows.length === 0) {
    return (
      <Text style={styles.empty} testID="collections-empty">
        {t('collections.empty')}
      </Text>
    );
  }

  return (
    <View style={styles.list} testID="collections-list">
      {rows.map((row) => (
        <Link key={row.id} href={`/collections/${row.id}`} asChild>
          <Pressable
            style={styles.row}
            accessibilityRole="link"
            testID={`collections-row-${row.id}`}
          >
            <Text style={styles.title}>{row.title}</Text>
            <Text style={styles.meta}>
              {t('collections.memberCount', { count: row.memberCount })}
            </Text>
          </Pressable>
        </Link>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 2,
  },
  row: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e4e4e7',
    gap: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: '500',
    color: '#18181b',
  },
  meta: {
    fontSize: 13,
    color: '#71717a',
  },
  empty: {
    fontSize: 14,
    color: '#71717a',
    paddingVertical: 24,
  },
});
