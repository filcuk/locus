import { StubScreen } from '@/ui/StubScreen';
import { t } from '@/i18n';

export default function RegisterScreen() {
  return (
    <StubScreen title={t('auth.register.title')} body={t('auth.register.stub')} />
  );
}
