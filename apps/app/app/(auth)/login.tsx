import { StubScreen } from '@/ui/StubScreen';
import { t } from '@/i18n';

export default function LoginScreen() {
  return <StubScreen title={t('auth.login.title')} body={t('auth.login.stub')} />;
}
