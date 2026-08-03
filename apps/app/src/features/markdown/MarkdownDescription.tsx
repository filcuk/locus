import { Fragment } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useMarkdown } from 'react-native-marked';

/**
 * Renders an entry description as markdown (DESIGN §8).
 * Uses `react-native-marked` (stack A); raw HTML is treated as plain text by the lib.
 */
export function MarkdownDescription({
  value,
  testID,
}: {
  value: string;
  testID?: string;
}) {
  const trimmed = value.trim();
  const elements = useMarkdown(trimmed.length > 0 ? trimmed : '', {
    colorScheme: 'light',
  });

  if (trimmed.length === 0) {
    return null;
  }

  return (
    <View style={styles.root} testID={testID ?? 'markdown-description'}>
      {elements.map((element, index) => (
        <Fragment key={`md-${index}`}>{element}</Fragment>
      ))}
    </View>
  );
}

/** Fallback when description is empty — callers may prefer omitting entirely. */
export function MarkdownDescriptionEmpty({ label }: { label: string }) {
  return <Text style={styles.empty}>{label}</Text>;
}

const styles = StyleSheet.create({
  root: {
    gap: 4,
  },
  empty: {
    color: '#71717a',
    fontSize: 14,
  },
});
