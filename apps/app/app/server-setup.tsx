import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  clearSession,
  isAuthCancelled,
  messageForAuthError,
  probeServer,
} from '@/auth';
import { getServerUrl, isValidServerUrl, setServerUrl } from '@/config/server-url';
import { t } from '@/i18n';
import { cancelSync } from '@/sync';
import { ConnectionProgress } from '@/features/connection/ConnectionProgress';

export default function ServerSetupScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ change?: string }>();
  const changing = params.change === '1';
  const [url, setUrl] = useState(changing ? getServerUrl() ?? '' : '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(1);
  const controller = useRef<AbortController | null>(null);

  const onContinue = () => {
    const trimmed = url.trim();
    if (!isValidServerUrl(trimmed)) {
      setError(t('serverSetup.invalidUrl'));
      return;
    }
    const requestController = new AbortController();
    controller.current = requestController;
    setBusy(true);
    setAttempt(1);
    setError(null);
    void (async () => {
      try {
        await probeServer({
          baseUrl: trimmed,
          signal: requestController.signal,
          onProgress: ({ attempt: nextAttempt }) => {
            setAttempt(nextAttempt);
          },
        });
        if (changing) {
          cancelSync();
          await clearSession();
        }
        await setServerUrl(trimmed);
        router.replace('/(auth)/login');
      } catch (err) {
        if (!isAuthCancelled(err)) {
          setError(
            messageForAuthError(err, {
              known: {},
              network: t('auth.errors.network'),
              generic: t('auth.errors.generic'),
            }),
          );
        }
      } finally {
        controller.current = null;
        setBusy(false);
      }
    })();
  };

  return (
    <View style={styles.root} testID="server-setup">
      <Text style={styles.title}>
        {changing ? t('serverSetup.changeTitle') : t('serverSetup.title')}
      </Text>
      <Text style={styles.subtitle}>
        {changing
          ? t('serverSetup.changeSubtitle')
          : t('serverSetup.subtitle')}
      </Text>
      <Text style={styles.label}>{t('serverSetup.urlLabel')}</Text>
      <TextInput
        testID="server-url-input"
        style={styles.input}
        value={url}
        onChangeText={setUrl}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        placeholder={t('serverSetup.urlPlaceholder')}
        placeholderTextColor="#a1a1aa"
        accessibilityLabel={t('serverSetup.urlLabel')}
      />
      {busy ? (
        <ConnectionProgress
          target={url.trim()}
          attempt={attempt}
          maxAttempts={3}
          onCancel={() => {
            controller.current?.abort();
          }}
        />
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable
        testID="server-url-save"
        style={styles.button}
        onPress={onContinue}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={t('serverSetup.continue')}
      >
        <Text style={styles.buttonLabel}>{t('serverSetup.continue')}</Text>
      </Pressable>
      {changing ? (
        <Pressable
          testID="server-url-cancel"
          style={styles.cancelButton}
          onPress={() => {
            if (busy) {
              controller.current?.abort();
              return;
            }
            router.back();
          }}
          accessibilityRole="button"
          accessibilityLabel={t('serverSetup.cancel')}
        >
          <Text style={styles.cancelLabel}>{t('serverSetup.cancel')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    padding: 24,
    gap: 12,
    justifyContent: 'center',
    backgroundColor: '#f4f4f5',
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: '#18181b',
  },
  subtitle: {
    fontSize: 16,
    color: '#52525b',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#27272a',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d4d4d8',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#18181b',
    backgroundColor: '#ffffff',
  },
  error: {
    color: '#b91c1c',
    fontSize: 14,
  },
  button: {
    marginTop: 8,
    backgroundColor: '#18181b',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonLabel: {
    color: '#fafafa',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  cancelLabel: {
    color: '#3f3f46',
    fontSize: 15,
  },
});
