import { useDatabase } from '@nozbe/watermelondb/hooks';
import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { getSessionUser } from '@/auth';
import {
  createUserTagLocal,
  retireUserTagLocal,
} from '@/db';
import { useViewerTags } from '@/features/tags';
import { t } from '@/i18n';
import { requestSyncPush } from '@/sync/activeDriver';
import { LOCAL_OWNER_PLACEHOLDER } from '@/features/new-entry/constants';

export default function SettingsTagsScreen() {
  const database = useDatabase();
  const { tags, loading } = useViewerTags();
  const [label, setLabel] = useState('');
  const [colour, setColour] = useState('#7c9cbf');
  const [busy, setBusy] = useState(false);

  const systemTags = tags.filter((tag) => tag.scope === 'system');
  const privateTags = tags.filter((tag) => tag.scope === 'user');

  const onCreate = () => {
    const trimmed = label.trim();
    if (trimmed.length === 0 || busy) return;
    setBusy(true);
    void (async () => {
      try {
        const user = await getSessionUser();
        await createUserTagLocal(database, {
          ownerId: user?.id ?? LOCAL_OWNER_PLACEHOLDER,
          label: trimmed,
          colour: colour.trim() || null,
        });
        setLabel('');
        requestSyncPush();
      } finally {
        setBusy(false);
      }
    })();
  };

  const onRetire = (tagId: string, strip: boolean) => {
    const tag = privateTags.find((row) => row.id === tagId);
    if (!tag || busy) return;
    setBusy(true);
    void (async () => {
      try {
        await retireUserTagLocal(database, tag, strip);
        requestSyncPush();
      } finally {
        setBusy(false);
      }
    })();
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t('settings.tags')}</Text>
      <Text style={styles.meta}>{t('settings.tags.intro')}</Text>

      <Text style={styles.section}>{t('settings.tags.private')}</Text>
      {loading ? (
        <Text style={styles.meta}>{t('common.loading')}</Text>
      ) : privateTags.length === 0 ? (
        <Text style={styles.meta} testID="settings-tags-private-empty">
          {t('settings.tags.privateEmpty')}
        </Text>
      ) : (
        privateTags.map((tag) => (
          <View key={tag.id} style={styles.row} testID={`settings-tag-${tag.id}`}>
            <View
              style={[
                styles.swatch,
                { backgroundColor: tag.colour ?? '#e4e4e7' },
              ]}
            />
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>
                {tag.label}
                {tag.retiredAt ? ` · ${t('settings.tags.retired')}` : ''}
              </Text>
              {!tag.retiredAt ? (
                <View style={styles.rowActions}>
                  <Pressable
                    onPress={() => onRetire(tag.id, false)}
                    accessibilityRole="button"
                    testID={`settings-tag-retire-${tag.id}`}
                  >
                    <Text style={styles.link}>{t('settings.tags.retire')}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => onRetire(tag.id, true)}
                    accessibilityRole="button"
                    testID={`settings-tag-strip-${tag.id}`}
                  >
                    <Text style={styles.link}>{t('settings.tags.retireStrip')}</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          </View>
        ))
      )}

      <Text style={styles.section}>{t('settings.tags.create')}</Text>
      <TextInput
        style={styles.input}
        value={label}
        onChangeText={setLabel}
        placeholder={t('settings.tags.labelPlaceholder')}
        testID="settings-tags-label"
      />
      <TextInput
        style={styles.input}
        value={colour}
        onChangeText={setColour}
        placeholder={t('settings.tags.colourPlaceholder')}
        autoCapitalize="none"
        testID="settings-tags-colour"
      />
      <Pressable
        style={styles.button}
        onPress={onCreate}
        accessibilityRole="button"
        testID="settings-tags-create"
      >
        <Text style={styles.buttonText}>{t('settings.tags.createAction')}</Text>
      </Pressable>

      <Text style={styles.section}>{t('settings.tags.system')}</Text>
      {systemTags.length === 0 ? (
        <Text style={styles.meta}>{t('settings.tags.systemEmpty')}</Text>
      ) : (
        systemTags.map((tag) => (
          <View key={tag.id} style={styles.row} testID={`settings-system-tag-${tag.id}`}>
            <View
              style={[
                styles.swatch,
                { backgroundColor: tag.colour ?? '#e4e4e7' },
              ]}
            />
            <Text style={styles.rowTitle}>
              {tag.namespace ? `${tag.namespace}:${tag.label}` : tag.label}
            </Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f4f4f5' },
  content: { padding: 24, gap: 10, paddingBottom: 48 },
  title: { fontSize: 22, fontWeight: '600', color: '#18181b' },
  section: {
    marginTop: 16,
    fontSize: 15,
    fontWeight: '600',
    color: '#27272a',
  },
  meta: { color: '#71717a', fontSize: 14 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e4e4e7',
  },
  swatch: { width: 16, height: 16, borderRadius: 4, marginTop: 2 },
  rowBody: { flex: 1, gap: 4 },
  rowTitle: { fontSize: 15, color: '#18181b' },
  rowActions: { flexDirection: 'row', gap: 12 },
  link: { color: '#1d4ed8', fontSize: 14 },
  input: {
    borderWidth: 1,
    borderColor: '#d4d4d8',
    borderRadius: 8,
    padding: 10,
    backgroundColor: '#fff',
    color: '#18181b',
  },
  button: {
    backgroundColor: '#18181b',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonText: { color: '#fafafa', fontWeight: '600' },
});
