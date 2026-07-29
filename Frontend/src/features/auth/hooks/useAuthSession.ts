import { useEffect } from 'react';
import { router, useSegments } from 'expo-router';
import { setAccessTokenProvider, setTokenRefresher } from '@/api/client';
import { useAuthStore } from '@/store/useAuthStore';

/**
 * `httpClient`와 인증 스토어를 잇는다.
 *
 * 모듈 최상단에서 한 번만 실행한다. 스토어가 `client.ts`를 이미 참조하므로
 * 반대 방향 import를 만들면 순환이 된다 — 그래서 양쪽을 아는 이 파일이 주입을 맡는다.
 */
setAccessTokenProvider(() => useAuthStore.getState().accessToken);
setTokenRefresher(() => useAuthStore.getState().refreshAccessToken());

/**
 * 앱 전체의 인증 수명주기를 담당한다. 루트 레이아웃에서 한 번만 쓴다.
 *
 * 1. secure store에 남은 세션을 복원한다
 * 2. 세션이 끊기면(재발급 실패 등) 보호된 화면에서 로그인으로 내보낸다
 *
 * 로그인 성공 후의 이동은 여기서 하지 않는다. 그건 `useOAuthLogin`이 서버가 준
 * `authStatus`를 보고 결정한다 — 온보딩을 서버에 알리는 API가 아직 없어서
 * 여기서 `ONBOARDING_REQUIRED`를 강제하면 온보딩을 끝내도 홈에 들어갈 수 없다.
 */
export function useAuthSession(): void {
  const hydrated = useAuthStore((state) => state.hydrated);
  const authStatus = useAuthStore((state) => state.authStatus);
  const hydrate = useAuthStore((state) => state.hydrate);
  const segments = useSegments();

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated || authStatus !== 'UNAUTHENTICATED') return;

    const group = segments[0];
    // `undefined`는 `app/index.tsx`다. 그 화면이 직접 분기하므로 건드리지 않는다.
    if (group === undefined || group === '(auth)') return;

    router.replace('/(auth)/login');
  }, [hydrated, authStatus, segments]);
}
