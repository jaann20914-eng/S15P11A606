import { apiRequest } from '../client';
import type { RefreshedTokens } from '@/types/auth';

/**
 * 토큰 재발급 — `POST /api/v1/auth/refresh`
 *
 * RTR 정책이라 **응답에 담긴 refreshToken까지 반드시 저장해야 한다**.
 * 요청에 쓴 값은 서버에서 즉시 폐기되므로 같은 값으로 두 번 부르면
 * `REFRESH_TOKEN_REUSED`로 세션이 끊긴다. 동시 호출 차단은 `useAuthStore`가 맡는다.
 *
 * 오류 코드: `REFRESH_TOKEN_REQUIRED` `INVALID_REFRESH_TOKEN` `REFRESH_TOKEN_REUSED`
 * `TOKEN_REFRESH_FAILED`. 앞의 셋은 재시도 여지가 없어 곧바로 로그아웃한다.
 */
export function refreshTokenPair(refreshToken: string): Promise<RefreshedTokens> {
  return apiRequest<RefreshedTokens>({
    method: 'POST',
    url: '/api/v1/auth/refresh',
    data: { refreshToken },
  });
}
