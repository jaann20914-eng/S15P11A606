import { MOCK_LATENCY_MS } from './pin';
import type { OAuthLoginResult, OAuthProvider } from '@/types/auth';

/**
 * 소셜 로그인 고정 응답.
 *
 * 목업 모드에서는 브라우저를 열지 않고 이 값을 바로 돌려준다(`useOAuthLogin`).
 * 카카오/네이버 콘솔 키나 App Link 없이도 온보딩 이후 화면을 볼 수 있게 하려는 것이다.
 *
 * 항상 `ONBOARDING_REQUIRED`를 준다. 서버 연동 전 흐름(로그인 → 온보딩)과 같고,
 * 목업 토큰으로 서비스 API를 부르는 실수도 막을 수 있다.
 */
export function mockOAuthLogin(provider: OAuthProvider): Promise<OAuthLoginResult> {
  return new Promise((resolve) => {
    setTimeout(
      () => resolve({ authStatus: 'ONBOARDING_REQUIRED', onboardingToken: `mock-onboarding-${provider}` }),
      MOCK_LATENCY_MS,
    );
  });
}
