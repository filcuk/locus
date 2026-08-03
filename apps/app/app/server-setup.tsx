import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { isValidServerUrl, setServerUrl } from '@/config/server-url';
import { t } from '@/i18n';

export default function ServerSetupScreen() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onContinue = () => {
    const trimmed = url.trim();
    if (!isValidServerUrl(trimmed)) {
      setError(t('serverSetup.invalidUrl'));
      return;
    }
    void (async () => {
      await setServerUrl(trimmed);
      setError(null);
      router.replace('/(auth)/login');
    })();
  };

  return (
    <View style={styles.root} testID="server-setup">
      <Text style={styles.title}>{t('serverSetup.title')}</Text>
      <Text style={styles.subtitle}>{t('serverSetup.subtitle')}</Text>
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
        accessibilityLabel={t('serverSetup.urlLabel')}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable
        testID="server-url-save"
        style={styles.button}
        onPress={onContinue}
        accessibilityRole="button"
        accessibilityLabel={t('serverSetup.continue')}
      >
        <Text style={styles.buttonLabel}>{t('serverSetup.continue')}</Text>
      </Pressable>
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
});
