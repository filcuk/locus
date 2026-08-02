import { useDatabase } from '@nozbe/watermelondb/hooks';
import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { PLACEHOLDER_COORDS } from './constants';
import { createOfflinePoint } from './createOfflinePoint';
import { tm } from './messages';
import { parseCoords } from './parseCoords';

type FormStatus =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; id: string }
  | { kind: 'error'; message: string };

export function NewPointForm() {
  const database = useDatabase();
  const [title, setTitle] = useState('');
  const [latText, setLatText] = useState('');
  const [lonText, setLonText] = useState('');
  const [usePlaceholder, setUsePlaceholder] = useState(true);
  const [status, setStatus] = useState<FormStatus>({ kind: 'idle' });

  const saving = status.kind === 'saving';

  const onSave = () => {
    if (saving) return;

    const trimmed = title.trim();
    if (trimmed.length === 0) {
      setStatus({ kind: 'error', message: tm('new.point.errorTitleRequired') });
      return;
    }

    let lat: number = PLACEHOLDER_COORDS.lat;
    let lon: number = PLACEHOLDER_COORDS.lon;
    if (!usePlaceholder) {
      const parsed = parseCoords(latText, lonText);
      if (!parsed.ok) {
        setStatus({ kind: 'error', message: tm('new.point.errorCoords') });
        return;
      }
      lat = parsed.lat;
      lon = parsed.lon;
    }

    setStatus({ kind: 'saving' });
    void createOfflinePoint(database, {
      title: trimmed,
      lat,
      lon,
      usePlaceholderCoords: usePlaceholder,
    })
      .then((point) => {
        setStatus({ kind: 'saved', id: point.id });
        setTitle('');
        setLatText('');
        setLonText('');
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : tm('new.point.errorTitle');
        setStatus({ kind: 'error', message });
      });
  };

  return (
    <View style={styles.form} testID="new-point-form">
      <Text style={styles.label}>{tm('new.point.titleLabel')}</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder={tm('new.point.titlePlaceholder')}
        editable={!saving}
        autoCapitalize="sentences"
        testID="new-point-title"
      />

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>{tm('new.point.usePlaceholderCoords')}</Text>
        <Switch
          value={usePlaceholder}
          onValueChange={setUsePlaceholder}
          disabled={saving}
          testID="new-point-placeholder-switch"
        />
      </View>

      {usePlaceholder ? (
        <Text style={styles.hint} testID="new-point-placeholder-hint">
          {tm('new.point.placeholderHint', PLACEHOLDER_COORDS)}
        </Text>
      ) : (
        <View style={styles.coordsRow}>
          <View style={styles.coordField}>
            <Text style={styles.label}>{tm('new.point.latLabel')}</Text>
            <TextInput
              style={styles.input}
              value={latText}
              onChangeText={setLatText}
              keyboardType="decimal-pad"
              editable={!saving}
              testID="new-point-lat"
            />
          </View>
          <View style={styles.coordField}>
            <Text style={styles.label}>{tm('new.point.lonLabel')}</Text>
            <TextInput
              style={styles.input}
              value={lonText}
              onChangeText={setLonText}
              keyboardType="decimal-pad"
              editable={!saving}
              testID="new-point-lon"
            />
          </View>
        </View>
      )}

      <Pressable
        style={[styles.button, saving && styles.buttonDisabled]}
        onPress={onSave}
        disabled={saving}
        accessibilityRole="button"
        accessibilityLabel={tm('new.point.save')}
        testID="new-point-save"
      >
        <Text style={styles.buttonLabel}>
          {saving ? tm('new.point.saving') : tm('new.point.save')}
        </Text>
      </Pressable>

      {status.kind === 'saved' ? (
        <Text style={styles.success} testID="new-point-saved">
          {tm('new.point.saved', { id: status.id })}
        </Text>
      ) : null}
      {status.kind === 'error' ? (
        <Text style={styles.error} testID="new-point-error">
          {status.message}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 12,
  },
  label: {
    fontSize: 14,
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
    color: '#18181b',
    backgroundColor: '#fff',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 4,
  },
  switchLabel: {
    flex: 1,
    fontSize: 15,
    color: '#18181b',
  },
  hint: {
    fontSize: 14,
    color: '#71717a',
  },
  coordsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  coordField: {
    flex: 1,
    gap: 8,
  },
  button: {
    marginTop: 8,
    backgroundColor: '#18181b',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonLabel: {
    color: '#fafafa',
    fontSize: 16,
    fontWeight: '600',
  },
  success: {
    fontSize: 14,
    color: '#15803d',
  },
  error: {
    fontSize: 14,
    color: '#b91c1c',
  },
});
