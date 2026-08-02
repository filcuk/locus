import { StubScreen } from '@/ui/StubScreen';
import { t } from '@/i18n';

export default function CollectionDetailScreen() {
  return (
    <StubScreen
      title={t('collection.detail.title')}
      body={t('collection.detail.stub')}
    />
  );
}
