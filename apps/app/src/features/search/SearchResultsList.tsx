import { Link, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { t } from '@/i18n';

import type { SearchKind, SearchMatchField, SearchResult } from './types';

type SearchResultsListProps = {
  results: SearchResult[];
  loading: boolean;
  query: string;
};

export function SearchResultsList({
  results,
  loading,
  query,
}: SearchResultsListProps) {
  if (loading) {
    return <Text style={styles.meta}>{t('common.loading')}</Text>;
  }

  const trimmed = query.trim();
  if (trimmed.length === 0) {
    return (
      <Text style={styles.empty} testID="search-prompt">
        {t('search.prompt')}
      </Text>
    );
  }

  if (results.length === 0) {
    return (
      <Text style={styles.empty} testID="search-empty">
        {t('search.empty')}
      </Text>
    );
  }

  return (
    <View style={styles.list} testID="search-results">
      {results.map((row) => (
        <Link
          key={`${row.kind}:${row.id}`}
          href={hrefFor(row.kind, row.id)}
          asChild
        >
          <Pressable
            style={styles.row}
            accessibilityRole="link"
            testID={`search-row-${row.kind}-${row.id}`}
          >
            <Text style={styles.title}>{row.title}</Text>
            <Text style={styles.meta}>
              {kindLabel(row.kind)}
              {` · ${matchLabel(row.matchField)}`}
            </Text>
          </Pressable>
        </Link>
      ))}
    </View>
  );
}

function hrefFor(kind: SearchKind, id: string): Href {
  if (kind === 'area') return `/areas/${id}`;
  if (kind === 'place') return `/places/${id}`;
  if (kind === 'point') return `/points/${id}`;
  return `/collections/${id}`;
}

function kindLabel(kind: SearchKind): string {
  if (kind === 'area') return t('search.kind.area');
  if (kind === 'place') return t('search.kind.place');
  if (kind === 'point') return t('search.kind.point');
  return t('search.kind.collection');
}

function matchLabel(field: SearchMatchField): string {
  if (field === 'title') return t('search.match.title');
  if (field === 'description') return t('search.match.description');
  return t('search.match.tag');
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
