import { router } from 'expo-router';

/**
 * 뒤로 가되, 돌아갈 화면이 없으면 홈으로 보낸다.
 * 알림·딥링크로 상세 화면에 바로 진입하면 히스토리가 비어 있어 `router.back()`이 실패한다.
 */
export function goBackOrHome(): void {
  if (router.canGoBack()) router.back();
  else router.replace('/(tabs)/home');
}
