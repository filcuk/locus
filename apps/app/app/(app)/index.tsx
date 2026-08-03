import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  HomeEntryList,
  useHomeHierarchy,
  useOneShotLocation,
} from '@/features/home';
import { t } from '@/i18n';
import { MapView } from '@/map';
import { refreshSync } from '@/sync';

/** Home — map + hierarchical entry list (DESIGN §8). */
export default function HomeScreen() {
  const { fix, refresh: refreshFix } = useOneShotLocation();
  const { roots, loading } = useHomeHierarchy(fix);
  const [refreshing, setRefreshing] = useState(false);

  const recompute = useCallback(async () => {
    await refreshFix();
  }, [refreshFix]);

  useFocusEffect(
    useCallback(() => {
      void recompute();
    }, [recompute]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([recompute(), refreshSync()]);
    } finally {
      setRefreshing(false);
    }
  }, [recompute]);

  return (
    <View style={styles.root} testID="home-screen">
      <MapView style={styles.map} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />
        }
      >
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{t('home.title')}</Text>
            <Link href="/search" asChild>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={t('search.open')}
                testID="home-search"
              >
                <Text style={styles.searchLink}>{t('search.open')}</Text>
              </Pressable>
            </Link>
          </View>
          <View style={styles.tabs}>
            <Text style={[styles.tab, styles.tabActive]}>{t('home.entriesTab')}</Text>
            <Link href="/collections" asChild>
              <Pressable accessibilityRole="link">
                <Text style={styles.tab}>{t('home.collectionsTab')}</Text>
              </Pressable>
            </Link>
          </View>
        </View>
        <HomeEntryList roots={roots} loading={loading} />
      </ScrollView>
      <Link href="/new" asChild>
        <Pressable
          style={styles.fab}
          accessibilityRole="button"
          accessibilityLabel={t('home.add')}
          testID="home-fab"
        >
          <Text style={styles.fabLabel}>+</Text>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f4f4f5',
  },
  map: {
    height: 220,
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
