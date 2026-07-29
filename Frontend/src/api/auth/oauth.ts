import { ApiError, UNKNOWN_ERROR_CODE, apiRequest } from '../client';
import { usesMockApi } from '../config';
import { mockOAuthLogin } from '@/mocks/auth';
import type { OAuthLoginResult, OAuthProvider } from '@/types/auth';

/** 서버가 보내는 원본 모양. 두 분기가 한 객체로 오므로 필드가 선택적이다. */
interface OAuthLoginResponse {
  authStatus?: string;
  accessToken?: string;
  refreshToken?: string;
  onboardingToken?: string;
}

/**
 * 응답을 판별 유니온으로 좁힌다.
 *
 * 분기에 필요한 토큰이 비어 있으면 여기서 끊는다. 그대로 통과시키면
 * `undefined`가 저장돼 다음 API 호출에서야 정체 모를 401로 드러난다.
 */
function toOAuthLoginResult(body: OAuthLoginResponse): OAuthLoginResult {
  if (body.authStatus === 'AUTHENTICATED' && body.accessToken && body.refreshToken) {
    return {
      authStatus: 'AUTHENTICATED',
      accessToken: body.accessToken,
      refreshToken: body.refreshToken,
    };
  }

  if (body.authStatus === 'ONBOARDING_REQUIRED' && body.onboardingToken) {
    return { authStatus: 'ONBOARDING_REQUIRED', onboardingToken: body.onboardingToken };
  }

  throw new ApiError(200, UNKNOWN_ERROR_CODE, '로그인 응답을 처리하지 못했어요');
}

/**
 * 소셜 로그인 — `POST /api/v1/auth/oauth/{provider}`
 *
 * 시스템 브라우저에서 받아온 인가 코드를 서버에 넘겨 서비스 토큰으로 바꾼다.
 * `state`는 호출 전에 이미 검증했지만 서버도 한 번 더 확인하므로 그대로 함께 보낸다.
 *
 * 오류 코드: `AUTH_PROVIDER_INVALID` `INVALID_OAUTH_REQUEST` `AUTH_OAUTH_FAILED`
 * `AUTH_PROCESS_FAILED`.
 */
function requestOAuthLogin(
  provider: OAuthProvider,
  authorizationCode: string,
  state: string,
): Promise<OAuthLoginResult> {
  return apiRequest<OAuthLoginResponse>({
    method: 'POST',
    url: `/api/v1/auth/oauth/${provider}`,
    data: { authorizationCode, state },
  }).then(toOAuthLoginResult);
}

export function signInWithOAuth(
  provider: OAuthProvider,
  authorizationCode: string,
  state: string,
): Promise<OAuthLoginResult> {
  return usesMockApi ? mockOAuthLogin(provider) : requestOAuthLogin(provider, authorizationCode, state);
}
