import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { SearchResultsList, useSearchResults } from '@/features/search';
import { t } from '@/i18n';

/** Local WatermelonDB search (DESIGN §8) — no network from the UI. */
export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const { results, loading } = useSearchResults(query);

  return (
    <View style={styles.root} testID="search-screen">
      <Text style={styles.title}>{t('search.title')}</Text>
      <TextInput
        style={styles.input}
        value={query}
        onChangeText={setQuery}
        placeholder={t('search.placeholder')}
        placeholderTextColor="#a1a1aa"
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
        testID="search-input"
        accessibilityLabel={t('search.placeholder')}
      />
      <SearchResultsList results={results} loading={loading} query={query} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f4f4f5',
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#18181b',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d4d4d8',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#18181b',
  },
});
