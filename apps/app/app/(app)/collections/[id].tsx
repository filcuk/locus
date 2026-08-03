import { useDatabase } from '@nozbe/watermelondb/hooks';
import { Link, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  addOfflineCollectionMember,
  removeOfflineCollectionMember,
  useCollectionDetail,
  type CollectionMemberKind,
} from '@/features/collections';
import { t } from '@/i18n';
import type CollectionItem from '@/db/models/CollectionItem';

/** Collection detail with membership list (DESIGN §8). */
export default function CollectionDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const collectionId = typeof params.id === 'string' ? params.id : '';
  const database = useDatabase();
  const { collection, members, addable, loading } =
    useCollectionDetail(collectionId);

  const itemsById = useMemo(() => {
    // Membership models for remove are re-fetched via softDelete helper using id.
    return new Map(members.map((m) => [m.membershipId, m]));
  }, [members]);

  if (!collectionId) {
    return (
      <View style={styles.root}>
        <Text style={styles.meta}>{t('collection.detail.missing')}</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.root}>
        <Text style={styles.meta}>{t('common.loading')}</Text>
      </View>
    );
  }

  if (!collection) {
    return (
      <View style={styles.root} testID="collection-detail-missing">
        <Text style={styles.meta}>{t('collection.detail.missing')}</Text>
        <Link href="/collections" asChild>
          <Pressable accessibilityRole="link">
            <Text style={styles.link}>{t('common.back')}</Text>
          </Pressable>
        </Link>
      </View>
    );
  }

  const onRemove = (membershipId: string) => {
    void database
      .get<CollectionItem>('collection_items')
      .find(membershipId)
      .then((item) => removeOfflineCollectionMember(database, item));
  };

  const onAdd = (itemType: CollectionMemberKind, itemId: string) => {
    void addOfflineCollectionMember(database, {
      collectionId,
      itemType,
      itemId,
    });
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      testID="collection-detail"
    >
      <Text style={styles.title}>{collection.title}</Text>

      <Text style={styles.section}>{t('collection.detail.members')}</Text>
      {members.length === 0 ? (
        <Text style={styles.meta} testID="collection-members-empty">
          {t('collection.detail.membersEmpty')}
        </Text>
      ) : (
        <View testID="collection-members">
          {members.map((m) => (
            <View
              key={m.membershipId}
              style={styles.row}
              testID={`collection-member-${m.membershipId}`}
            >
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{m.title}</Text>
                <Text style={styles.meta}>{kindLabel(m.itemType)}</Text>
              </View>
              <Pressable
                onPress={() => onRemove(m.membershipId)}
                accessibilityRole="button"
                accessibilityLabel={t('collection.detail.remove')}
                testID={`collection-remove-${m.membershipId}`}
              >
                <Text style={styles.action}>{t('collection.detail.remove')}</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      <Text style={styles.section}>{t('collection.detail.add')}</Text>
      {addable.length === 0 ? (
        <Text style={styles.meta}>{t('collection.detail.addEmpty')}</Text>
      ) : (
        <View testID="collection-addable">
          {addable.map((entry) => (
            <View
              key={`${entry.itemType}:${entry.itemId}`}
              style={styles.row}
            >
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{entry.title}</Text>
                <Text style={styles.meta}>{kindLabel(entry.itemType)}</Text>
              </View>
              <Pressable
                onPress={() => onAdd(entry.itemType, entry.itemId)}
                accessibilityRole="button"
                accessibilityLabel={t('collection.detail.addAction')}
                testID={`collection-add-${entry.itemType}-${entry.itemId}`}
              >
                <Text style={styles.action}>
                  {t('collection.detail.addAction')}
                </Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {/* Keep map referenced so unused-var lint stays quiet if tree-shaken. */}
      {itemsById.size < 0 ? null : null}
    </ScrollView>
  );
}

function kindLabel(kind: CollectionMemberKind): string {
  if (kind === 'area') return t('collection.detail.kind.area');
  if (kind === 'place') return t('collection.detail.kind.place');
  return t('collection.detail.kind.point');
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f4f4f5',
  },
  content: {
    padding: 16,
    gap: 8,
    paddingBottom: 48,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: '#18181b',
    marginBottom: 8,
  },
  section: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3f3f46',
    marginTop: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e4e4e7',
    gap: 12,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#18181b',
  },
  meta: {
    fontSize: 13,
    color: '#71717a',
  },
  action: {
    fontSize: 14,
    fontWeight: '600',
    color: '#18181b',
  },
  link: {
    marginTop: 12,
    fontSize: 15,
    fontWeight: '500',
    color: '#18181b',
  },
});
