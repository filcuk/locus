import { useLocalSearchParams } from 'expo-router';

import { EntryDetailScreen } from '@/features/entry';

export default function PlaceDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  return <EntryDetailScreen kind="place" id={id} />;
}
