import { Redirect } from 'expo-router';

import { hasServerUrl } from '@/config/server-url';

/**
 * Gate: server URL precedes login (DESIGN §8). No instance host is baked in.
 */
export default function Index() {
  if (!hasServerUrl()) {
    return <Redirect href="/server-setup" />;
  }
  return <Redirect href="/(auth)/login" />;
}
