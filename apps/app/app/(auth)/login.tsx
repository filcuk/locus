import { Link, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  isAuthCancelled,
  login,
  messageForAuthError,
} from '@/auth';
import { getServerUrl } from '@/config/server-url';
import { ConnectionProgress } from '@/features/connection/ConnectionProgress';
import { t } from '@/i18n';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(1);
  const controller = useRef<AbortController | null>(null);
  const serverUrl = getServerUrl() ?? '';

  const onSubmit = async () => {
    const requestController = new AbortController();
    controller.current = requestController;
    setError(null);
    setBusy(true);
    setAttempt(1);
    try {
      await login(
        { email: email.trim(), password },
        {
          signal: requestController.signal,
          onProgress: ({ attempt: nextAttempt }) => {
            setAttempt(nextAttempt);
          },
        },
      );
      router.replace('/(app)');
    } catch (err) {
      if (!isAuthCancelled(err)) {
        setError(
          messageForAuthError(err, {
            known: {
              invalid_credentials: t('auth.login.invalidCredentials'),
              rate_limited: t('auth.errors.rateLimited'),
            },
            network: t('auth.errors.network'),
            generic: t('auth.errors.generic'),
          }),
        );
      }
    } finally {
      controller.current = null;
      setBusy(false);
    }
  };

  return (
    <View style={styles.root} testID="auth-login">
      <Text style={styles.title}>{t('auth.login.title')}</Text>
      <Text style={styles.subtitle}>{t('auth.login.subtitle')}</Text>

      <Text style={styles.label}>{t('auth.fields.email')}</Text>
      <TextInput
        testID="auth-login-email"
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        autoComplete="email"
        placeholderTextColor="#a1a1aa"
        accessibilityLabel={t('auth.fields.email')}
      />

      <Text style={styles.label}>{t('auth.fields.password')}</Text>
      <TextInput
        testID="auth-login-password"
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        textContentType="password"
        autoComplete="password"
        placeholderTextColor="#a1a1aa"
        accessibilityLabel={t('auth.fields.password')}
      />

      {error ? (
        <Text style={styles.error} testID="auth-login-error">
          {error}
        </Text>
      ) : null}
      {busy ? (
        <ConnectionProgress
          target={serverUrl}
          attempt={attempt}
          maxAttempts={1}
          onCancel={() => {
            controller.current?.abort();
          }}
        />
      ) : null}

      <Pressable
        testID="auth-login-submit"
        style={[styles.button, busy && styles.buttonDisabled]}
        onPress={() => {
          void onSubmit();
        }}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={t('auth.login.submit')}
      >
        {busy ? (
          <ActivityIndicator color="#fafafa" />
        ) : (
          <Text style={styles.buttonLabel}>{t('auth.login.submit')}</Text>
        )}
      </Pressable>

      <Link href="/(auth)/register" style={styles.link} testID="auth-login-register">
        {t('auth.login.toRegister')}
      </Link>
      <Link
        href="/(auth)/forgot-password"
        style={styles.link}
        testID="auth-login-forgot"
      >
        {t('auth.login.toForgot')}
      </Link>
      <Link
        href="/server-setup?change=1"
        style={styles.link}
        testID="auth-login-change-server"
      >
        {t('settings.sync.changeServer')}
      </Link>
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
    minHeight: 48,
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonLabel: {
    color: '#fafafa',
    fontSize: 16,
    fontWeight: '600',
  },
  link: {
    color: '#3f3f46',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 4,
  },
});
