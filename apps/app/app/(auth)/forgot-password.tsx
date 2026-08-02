import { StubScreen } from '@/ui/StubScreen';
import { t } from '@/i18n';

export default function ForgotPasswordScreen() {
  return (
    <StubScreen
      title={t('auth.forgotPassword.title')}
      body={t('auth.forgotPassword.stub')}
    />
  );
}
