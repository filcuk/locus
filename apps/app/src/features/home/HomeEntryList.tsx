import { Link, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { t } from '@/i18n';

import type { EntryKind, HierarchyNode } from './types';

type HomeEntryListProps = {
  roots: HierarchyNode[];
  loading: boolean;
};

export function HomeEntryList({ roots, loading }: HomeEntryListProps) {
  if (loading) {
    return <Text style={styles.meta}>{t('common.loading')}</Text>;
  }
  if (roots.length === 0) {
    return (
      <Text style={styles.empty} testID="home-empty">
        {t('home.empty')}
      </Text>
    );
  }

  return (
    <View style={styles.list} testID="home-entry-list">
      {roots.map((node) => (
        <HierarchyRow key={`${node.record.kind}:${node.record.id}`} node={node} depth={0} />
      ))}
    </View>
  );
}

function HierarchyRow({ node, depth }: { node: HierarchyNode; depth: number }) {
  const href = hrefFor(node.record.kind, node.record.id);
  const kindLabel = kindLabelFor(node.record.kind);

  return (
    <View>
      <Link href={href} asChild>
        <Pressable
          style={[styles.row, { paddingLeft: 12 + depth * 16 }]}
          accessibilityRole="link"
          testID={`home-row-${node.record.kind}-${node.record.id}`}
        >
          <View style={styles.rowText}>
            <Text style={styles.title}>{node.record.title}</Text>
            <Text style={styles.meta}>
              {kindLabel}
              {node.youAreHere ? ` · ${t('home.youAreHere')}` : ''}
              {formatDistance(node.distanceMeters)}
            </Text>
          </View>
        </Pressable>
      </Link>
      {node.children.map((child) => (
        <HierarchyRow
          key={`${child.record.kind}:${child.record.id}`}
          node={child}
          depth={depth + 1}
        />
      ))}
    </View>
  );
}

function hrefFor(kind: EntryKind, id: string): Href {
  if (kind === 'area') return `/areas/${id}`;
  if (kind === 'place') return `/places/${id}`;
  return `/points/${id}`;
}

function kindLabelFor(kind: EntryKind): string {
  if (kind === 'area') return t('home.kind.area');
  if (kind === 'place') return t('home.kind.place');
  return t('home.kind.point');
}

function formatDistance(metres: number | null): string {
  if (metres == null) return '';
  if (!Number.isFinite(metres)) return '';
  if (metres < 1) return ` · ${t('home.distance.here')}`;
  if (metres < 1000) return ` · ${Math.round(metres)} m`;
  return ` · ${(metres / 1000).toFixed(1)} km`;
}

const styles = StyleSheet.create({
  list: {
    gap: 2,
  },
  row: {
    paddingVertical: 10,
    paddingRight: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e4e4e7',
  },
  rowText: {
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
    fontSize: 16,
    color: '#71717a',
    marginTop: 8,
  },
});
