import { useDatabase } from '@nozbe/watermelondb/hooks';
import { Link } from 'expo-router';
import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { MarkdownDescription } from '@/features/markdown';
import { t } from '@/i18n';

import {
  addOfflineComment,
  addOfflineNote,
  addOfflineVisit,
} from './offlineWrites';
import type { EntryKind, EntryTimelineItem } from './types';
import { toTargetType } from './types';
import { useEntryDetail } from './useEntryDetail';

type FabMode = 'visit' | 'note' | 'comment' | null;

/**
 * Entry screen shell: title, markdown description, visit stats, notes/comments
 * timeline, FAB for add visit / note / comment (DESIGN §8). Gallery/tags later.
 */
export function EntryDetailScreen({
  kind,
  id,
}: {
  kind: EntryKind;
  id: string;
}) {
  const database = useDatabase();
  const {
    entry,
    timeline,
    visitCount,
    lastVisitAt,
    loading,
  } = useEntryDetail(kind, id);
  const [fabOpen, setFabOpen] = useState(false);
  const [mode, setMode] = useState<FabMode>(null);
  const [draft, setDraft] = useState('');

  if (!id) {
    return (
      <View style={styles.root}>
        <Text style={styles.meta}>{t('entry.detail.missing')}</Text>
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

  if (!entry) {
    return (
      <View style={styles.root} testID="entry-detail-missing">
        <Text style={styles.meta}>{t('entry.detail.missing')}</Text>
        <Link href="/" asChild>
          <Pressable accessibilityRole="link">
            <Text style={styles.link}>{t('common.back')}</Text>
          </Pressable>
        </Link>
      </View>
    );
  }

  const title = entry.row.title;
  const description = entry.row.description;

  const closeComposer = () => {
    setMode(null);
    setDraft('');
  };

  const submitComposer = () => {
    const targetType = toTargetType(kind);
    const body = draft.trim();
    void (async () => {
      if (mode === 'visit') {
        await addOfflineVisit(database, {
          targetType,
          targetId: id,
          body: body.length > 0 ? body : null,
        });
      } else if (mode === 'note') {
        if (body.length === 0) return;
        await addOfflineNote(database, {
          targetType,
          targetId: id,
          body,
        });
      } else if (mode === 'comment') {
        if (body.length === 0) return;
        await addOfflineComment(database, {
          targetType,
          targetId: id,
          body,
        });
      }
      closeComposer();
    })();
  };

  return (
    <View style={styles.flex} testID={`entry-detail-${kind}`}>
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
        <Text style={styles.title} testID="entry-title">
          {title}
        </Text>

        {description != null && description.trim().length > 0 ? (
          <MarkdownDescription value={description} />
        ) : (
          <Text style={styles.meta}>{t('entry.detail.noDescription')}</Text>
        )}

        <Text style={styles.section}>{t('entry.detail.visits')}</Text>
        <Text style={styles.meta} testID="entry-visit-stats">
          {t('entry.detail.visitCount', { count: visitCount })}
          {lastVisitAt
            ? ` · ${t('entry.detail.lastVisit', {
                when: lastVisitAt.toISOString().slice(0, 10),
              })}`
            : ''}
        </Text>

        <Text style={styles.section}>{t('entry.detail.timeline')}</Text>
        {timeline.length === 0 ? (
          <Text style={styles.meta} testID="entry-timeline-empty">
            {t('entry.detail.timelineEmpty')}
          </Text>
        ) : (
          <View testID="entry-timeline">
            {timeline.map((item) => (
              <TimelineRow key={timelineKey(item)} item={item} />
            ))}
          </View>
        )}
      </ScrollView>

      {fabOpen ? (
        <View style={styles.fabMenu} testID="entry-fab-menu">
          <Pressable
            style={styles.fabAction}
            onPress={() => {
              setFabOpen(false);
              setMode('visit');
            }}
            accessibilityRole="button"
            accessibilityLabel={t('entry.fab.addVisit')}
            testID="entry-fab-visit"
          >
            <Text style={styles.fabActionText}>{t('entry.fab.addVisit')}</Text>
          </Pressable>
          <Pressable
            style={styles.fabAction}
            onPress={() => {
              setFabOpen(false);
              setMode('note');
            }}
            accessibilityRole="button"
            accessibilityLabel={t('entry.fab.addNote')}
            testID="entry-fab-note"
          >
            <Text style={styles.fabActionText}>{t('entry.fab.addNote')}</Text>
          </Pressable>
          <Pressable
            style={styles.fabAction}
            onPress={() => {
              setFabOpen(false);
              setMode('comment');
            }}
            accessibilityRole="button"
            accessibilityLabel={t('entry.fab.addComment')}
            testID="entry-fab-comment"
          >
            <Text style={styles.fabActionText}>{t('entry.fab.addComment')}</Text>
          </Pressable>
        </View>
      ) : null}

      <Pressable
        style={styles.fab}
        onPress={() => setFabOpen((open) => !open)}
        accessibilityRole="button"
        accessibilityLabel={t('entry.fab.open')}
        testID="entry-fab"
      >
        <Text style={styles.fabLabel}>{fabOpen ? '×' : '+'}</Text>
      </Pressable>

      <Modal
        visible={mode != null}
        transparent
        animationType="fade"
        onRequestClose={closeComposer}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard} testID="entry-composer">
            <Text style={styles.section}>
              {mode === 'visit'
                ? t('entry.fab.addVisit')
                : mode === 'note'
                  ? t('entry.fab.addNote')
                  : t('entry.fab.addComment')}
            </Text>
            <TextInput
              style={styles.input}
              value={draft}
              onChangeText={setDraft}
              placeholder={
                mode === 'visit'
                  ? t('entry.composer.visitPlaceholder')
                  : mode === 'note'
                    ? t('entry.composer.notePlaceholder')
                    : t('entry.composer.commentPlaceholder')
              }
              multiline
              testID="entry-composer-input"
            />
            <View style={styles.modalActions}>
              <Pressable onPress={closeComposer} accessibilityRole="button">
                <Text style={styles.link}>{t('entry.composer.cancel')}</Text>
              </Pressable>
              <Pressable
                onPress={submitComposer}
                accessibilityRole="button"
                testID="entry-composer-submit"
              >
                <Text style={styles.action}>{t('entry.composer.save')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function TimelineRow({ item }: { item: EntryTimelineItem }) {
  if (item.kind === 'note') {
    const isVisit = item.note.visitedAt != null;
    return (
      <View style={styles.row} testID={`entry-note-${item.note.id}`}>
        <Text style={styles.rowTitle}>
          {isVisit ? t('entry.timeline.visit') : t('entry.timeline.note')}
        </Text>
        {item.note.body ? (
          <Text style={styles.meta}>{item.note.body}</Text>
        ) : null}
        <Text style={styles.meta}>
          {(item.note.visitedAt ?? item.note.createdAt).toISOString().slice(0, 10)}
        </Text>
      </View>
    );
  }
  return (
    <View style={styles.row} testID={`entry-comment-${item.comment.id}`}>
      <Text style={styles.rowTitle}>{t('entry.timeline.comment')}</Text>
      <Text style={styles.meta}>{item.comment.body}</Text>
      <Text style={styles.meta}>
        {item.comment.createdAt.toISOString().slice(0, 10)}
      </Text>
    </View>
  );
}

function timelineKey(item: EntryTimelineItem): string {
  return item.kind === 'note' ? `n:${item.note.id}` : `c:${item.comment.id}`;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: { flex: 1, backgroundColor: '#fafafa' },
  content: { padding: 16, paddingBottom: 96, gap: 8 },
  title: { fontSize: 22, fontWeight: '600', color: '#18181b' },
  section: {
    marginTop: 16,
    fontSize: 15,
    fontWeight: '600',
    color: '#27272a',
  },
  meta: { color: '#71717a', fontSize: 14 },
  link: { color: '#2563eb', fontSize: 15, marginTop: 8 },
  action: { color: '#18181b', fontWeight: '600', fontSize: 15 },
  row: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e4e4e7',
    gap: 2,
  },
  rowTitle: { fontSize: 15, fontWeight: '500', color: '#18181b' },
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
  fabLabel: { color: '#fafafa', fontSize: 28, lineHeight: 32 },
  fabMenu: {
    position: 'absolute',
    right: 20,
    bottom: 92,
    gap: 8,
    alignItems: 'flex-end',
  },
  fabAction: {
    backgroundColor: '#27272a',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  fabActionText: { color: '#fafafa', fontSize: 14 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  input: {
    minHeight: 88,
    borderWidth: 1,
    borderColor: '#d4d4d8',
    borderRadius: 8,
    padding: 10,
    textAlignVertical: 'top',
    color: '#18181b',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
  },
});
