import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AuthHttpError, register } from '@/auth';
import { t } from '@/i18n';

export default function RegisterScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    setError(null);
    setBusy(true);
    try {
      await register({
        email: email.trim(),
        password,
        display_name: displayName.trim(),
      });
      router.replace('/(app)');
    } catch (err) {
      if (err instanceof AuthHttpError) {
        if (err.code === 'email_taken') {
          setError(t('auth.register.emailTaken'));
        } else if (err.code === 'validation_failed') {
          setError(t('auth.register.validation'));
        } else if (err.code === 'rate_limited') {
          setError(t('auth.errors.rateLimited'));
        } else {
          setError(t('auth.errors.generic'));
        }
      } else {
        setError(t('auth.errors.generic'));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root} testID="auth-register">
      <Text style={styles.title}>{t('auth.register.title')}</Text>
      <Text style={styles.subtitle}>{t('auth.register.subtitle')}</Text>

      <Text style={styles.label}>{t('auth.fields.displayName')}</Text>
      <TextInput
        testID="auth-register-display-name"
        style={styles.input}
        value={displayName}
        onChangeText={setDisplayName}
        autoCapitalize="words"
        textContentType="name"
        accessibilityLabel={t('auth.fields.displayName')}
      />

      <Text style={styles.label}>{t('auth.fields.email')}</Text>
      <TextInput
        testID="auth-register-email"
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        autoComplete="email"
        accessibilityLabel={t('auth.fields.email')}
      />

      <Text style={styles.label}>{t('auth.fields.password')}</Text>
      <TextInput
        testID="auth-register-password"
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        textContentType="newPassword"
        autoComplete="new-password"
        accessibilityLabel={t('auth.fields.password')}
      />

      {error ? (
        <Text style={styles.error} testID="auth-register-error">
          {error}
        </Text>
      ) : null}

      <Pressable
        testID="auth-register-submit"
        style={[styles.button, busy && styles.buttonDisabled]}
        onPress={() => {
          void onSubmit();
        }}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={t('auth.register.submit')}
      >
        {busy ? (
          <ActivityIndicator color="#fafafa" />
        ) : (
          <Text style={styles.buttonLabel}>{t('auth.register.submit')}</Text>
        )}
      </Pressable>

      <Link href="/(auth)/login" style={styles.link} testID="auth-register-login">
        {t('auth.register.toLogin')}
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
