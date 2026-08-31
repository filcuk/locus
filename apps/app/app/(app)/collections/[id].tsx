import { useDatabase } from '@nozbe/watermelondb/hooks';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  addOfflineCollectionMember,
  deleteOfflineCollection,
  removeOfflineCollectionMember,
  updateOfflineCollection,
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
  const router = useRouter();
  const { collection, members, addable, loading } =
    useCollectionDetail(collectionId);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  const onEdit = () => {
    if (!collection) return;
    setTitle(collection.title);
    setEditError(null);
    setEditing(true);
  };

  const onSave = () => {
    if (!collection || saving) return;
    setSaving(true);
    setEditError(null);
    void updateOfflineCollection(database, collection, { title })
      .then(() => setEditing(false))
      .catch(() => setEditError(t('collection.detail.editError')))
      .finally(() => setSaving(false));
  };

  const onDelete = () => {
    if (!collection || deleting) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    void deleteOfflineCollection(database, collection)
      .then(() => router.replace('/collections'))
      .catch(() => setDeleting(false));
  };

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
      {editing ? (
        <View style={styles.editBox} testID="collection-edit">
          <Text style={styles.label}>{t('collection.detail.editTitle')}</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder={t('collection.detail.editPlaceholder')}
            editable={!saving}
            testID="collection-edit-title"
          />
          {editError ? <Text style={styles.error}>{editError}</Text> : null}
          <View style={styles.actions}>
            <Pressable
              onPress={() => {
                setEditing(false);
                setEditError(null);
              }}
              disabled={saving}
              accessibilityRole="button"
            >
              <Text style={styles.secondaryAction}>{t('collection.detail.cancel')}</Text>
            </Pressable>
            <Pressable
              onPress={onSave}
              disabled={saving}
              accessibilityRole="button"
              testID="collection-edit-submit"
            >
              <Text style={styles.primaryAction}>{t('collection.detail.save')}</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.header}>
          <Text style={styles.title}>{collection.title}</Text>
          <Pressable
            onPress={onEdit}
            accessibilityRole="button"
            testID="collection-edit-open"
          >
            <Text style={styles.action}>{t('collection.detail.edit')}</Text>
          </Pressable>
        </View>
      )}

      {confirmDelete ? (
        <View style={styles.deleteBox} testID="collection-delete-confirm">
          <Text style={styles.meta}>{t('collection.detail.deleteConfirm')}</Text>
          <View style={styles.actions}>
            <Pressable
              onPress={() => setConfirmDelete(false)}
              disabled={deleting}
              accessibilityRole="button"
            >
              <Text style={styles.secondaryAction}>{t('collection.detail.deleteCancel')}</Text>
            </Pressable>
            <Pressable
              onPress={onDelete}
              disabled={deleting}
              accessibilityRole="button"
              testID="collection-delete-submit"
            >
              <Text style={styles.dangerAction}>{t('collection.detail.deleteAction')}</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          onPress={onDelete}
          accessibilityRole="button"
          testID="collection-delete-open"
        >
          <Text style={styles.dangerAction}>{t('collection.detail.delete')}</Text>
        </Pressable>
      )}

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
  header: {
    gap: 8,
  },
  editBox: {
    gap: 8,
    paddingBottom: 8,
  },
  deleteBox: {
    gap: 8,
    paddingVertical: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: '#3f3f46',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d4d4d8',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#18181b',
  },
  error: {
    fontSize: 13,
    color: '#b91c1c',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
  },
  secondaryAction: {
    fontSize: 15,
    color: '#71717a',
    fontWeight: '500',
  },
  primaryAction: {
    fontSize: 15,
    color: '#18181b',
    fontWeight: '600',
  },
  dangerAction: {
    fontSize: 14,
    fontWeight: '600',
    color: '#b91c1c',
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
