import { StyleSheet, Text, View } from 'react-native';

type StubScreenProps = {
  title: string;
  body: string;
};

/** Minimal labelled placeholder — not final artwork (assets rule). */
export function StubScreen({ title, body }: StubScreenProps) {
  return (
    <View style={styles.root} accessibilityRole="summary">
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
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
  body: {
    fontSize: 16,
    lineHeight: 22,
    color: '#52525b',
  },
});
