import { Link } from 'expo-router';
import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useDatabase } from '@nozbe/watermelondb/hooks';

import {
  CollectionsList,
  createOfflineCollection,
  useCollectionsList,
} from '@/features/collections';
import { t } from '@/i18n';

/** Home's collections tab (DESIGN §8). */
export default function CollectionsScreen() {
  const database = useDatabase();
  const { rows, loading } = useCollectionsList();
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const onCreate = () => {
    if (saving) return;
    const trimmed = title.trim();
    if (trimmed.length === 0) {
      setError(t('collections.createErrorTitle'));
      return;
    }
    setSaving(true);
    setError(null);
    void createOfflineCollection(database, { title: trimmed })
      .then(() => {
        setTitle('');
        setCreating(false);
      })
      .catch(() => {
        setError(t('collections.createErrorTitle'));
      })
      .finally(() => {
        setSaving(false);
      });
  };

  return (
    <View style={styles.root} testID="collections-screen">
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{t('collections.title')}</Text>
            <Link href="/search" asChild>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={t('search.open')}
                testID="collections-search"
              >
                <Text style={styles.searchLink}>{t('search.open')}</Text>
              </Pressable>
            </Link>
          </View>
          <View style={styles.tabs}>
            <Link href="/" asChild>
              <Pressable accessibilityRole="link">
                <Text style={styles.tab}>{t('home.entriesTab')}</Text>
              </Pressable>
            </Link>
            <Text style={[styles.tab, styles.tabActive]}>
              {t('home.collectionsTab')}
            </Text>
          </View>
        </View>

        {creating ? (
          <View style={styles.createBox} testID="collections-create">
            <Text style={styles.label}>{t('collections.createTitle')}</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder={t('collections.createPlaceholder')}
              editable={!saving}
              testID="collections-create-title"
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <View style={styles.createActions}>
              <Pressable
                onPress={() => {
                  setCreating(false);
                  setTitle('');
                  setError(null);
                }}
                disabled={saving}
                accessibilityRole="button"
              >
                <Text style={styles.secondaryAction}>
                  {t('collections.createCancel')}
                </Text>
              </Pressable>
              <Pressable
                onPress={onCreate}
                disabled={saving}
                accessibilityRole="button"
                testID="collections-create-submit"
              >
                <Text style={styles.primaryAction}>
                  {t('collections.createSubmit')}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <CollectionsList rows={rows} loading={loading} />
      </ScrollView>

      {!creating ? (
        <Pressable
          style={styles.fab}
          accessibilityRole="button"
          accessibilityLabel={t('collections.add')}
          testID="collections-fab"
          onPress={() => setCreating(true)}
        >
          <Text style={styles.fabLabel}>+</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f4f4f5',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 88,
    gap: 8,
  },
  header: {
    gap: 8,
    paddingTop: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#18181b',
  },
  searchLink: {
    fontSize: 15,
    fontWeight: '500',
    color: '#18181b',
  },
  tabs: {
    flexDirection: 'row',
    gap: 16,
  },
  tab: {
    fontSize: 14,
    fontWeight: '500',
    color: '#71717a',
    paddingBottom: 4,
  },
  tabActive: {
    color: '#18181b',
    borderBottomWidth: 2,
    borderBottomColor: '#18181b',
  },
  createBox: {
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
  createActions: {
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
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#18181b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabLabel: {
    color: '#fafafa',
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '400',
  },
});
