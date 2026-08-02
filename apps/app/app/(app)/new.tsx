import { StyleSheet, Text, View } from 'react-native';

import { NewPointForm } from '@/features/new-entry';
import { t } from '@/i18n';

/** Minimal offline new-point entry (DESIGN §8 /new — type+parent picker later). */
export default function NewEntryScreen() {
  return (
    <View style={styles.root} testID="new-entry-screen">
      <Text style={styles.title}>{t('new.title')}</Text>
      <NewPointForm />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    padding: 24,
    gap: 16,
    backgroundColor: '#f4f4f5',
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: '#18181b',
  },
});
