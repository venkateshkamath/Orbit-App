import { router } from 'expo-router';

/**
 * Leave login/register: pop stack when possible, otherwise go to welcome.
 * Avoids React Navigation "GO_BACK was not handled" when history is empty.
 */
export function leaveAuthScreen(): void {
  if (typeof router.canGoBack === 'function' && router.canGoBack()) {
    router.back();
    return;
  }
  router.replace('/');
}
