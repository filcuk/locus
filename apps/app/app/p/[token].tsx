import { StubScreen } from '@/ui/StubScreen';
import { t } from '@/i18n';

/** Public read-only link (DESIGN §8). Token is never logged. */
export default function PublicLinkScreen() {
  return <StubScreen title={t('publicLink.title')} body={t('publicLink.stub')} />;
}
