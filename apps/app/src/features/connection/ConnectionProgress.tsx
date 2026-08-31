import { Pressable, StyleSheet, Text, View } from 'react-native';

import { t } from '@/i18n';

type Props = {
  target: string;
  attempt: number;
  maxAttempts: number;
  onCancel: () => void;
};

export function ConnectionProgress({
  target,
  attempt,
  maxAttempts,
  onCancel,
}: Props) {
  return (
    <View style={styles.root} testID="connection-progress">
      <Text style={styles.target} testID="connection-target">
        {t('connection.target', { target })}
      </Text>
      <Text style={styles.status} testID="connection-status">
        {t('connection.attempt', { attempt, maxAttempts })}
      </Text>
      <Pressable
        testID="connection-cancel"
        accessibilityRole="button"
        accessibilityLabel={t('connection.cancel')}
        onPress={onCancel}
        style={styles.button}
      >
        <Text style={styles.buttonLabel}>{t('connection.cancel')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 6,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#e4e4e7',
  },
  target: {
    fontSize: 14,
    fontWeight: '600',
    color: '#18181b',
  },
  status: {
    fontSize: 14,
    color: '#52525b',
  },
  button: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
  },
  buttonLabel: {
    color: '#1d4ed8',
    fontSize: 14,
    fontWeight: '600',
  },
});
