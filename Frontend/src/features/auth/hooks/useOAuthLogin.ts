import { useCallback, useState } from 'react';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { ApiError, NETWORK_ERROR_CODE } from '@/api/client';
import { usesMockApi } from '@/api/config';
import { signInWithOAuth } from '@/api/auth/oauth';
import { useAuthStore } from '@/store/useAuthStore';
import { buildAuthorizeUrl, createOAuthState, hasOAuthClientId, oauthRedirectUri } from '@/utils/oauth';
import type { OAuthProvider } from '@/types/auth';

/**
 * 오류 코드별 안내 문구.
 *
 * 서버 `message`를 그대로 쓰는 게 기본이지만(`ApiError`), 로그인은 첫 화면이라
 * 사용자가 다음에 뭘 해야 하는지가 문구에 들어가야 한다.
 * `AUTH_PROVIDER_INVALID`는 앱이 잘못된 provider를 보낸 경우라 사용자가 할 수 있는 게 없다.
 */
const ERROR_MESSAGE: Record<string, string> = {
  AUTH_PROVIDER_INVALID: '앱에 문제가 생겼어요. 업데이트 후 다시 시도해 주세요',
  INVALID_OAUTH_REQUEST: '로그인 정보가 올바르지 않아요. 다시 시도해 주세요',
  AUTH_OAUTH_FAILED: '소셜 로그인에 실패했어요. 다시 시도해 주세요',
  AUTH_PROCESS_FAILED: '서버에 문제가 생겼어요. 잠시 후 다시 시도해 주세요',
  [NETWORK_ERROR_CODE]: '네트워크 연결을 확인하고 다시 시도해 주세요',
};

function toErrorMessage(cause: unknown): string {
  if (cause instanceof ApiError) {
    return ERROR_MESSAGE[cause.code] ?? cause.message;
  }

  return '로그인하지 못했어요. 다시 시도해 주세요';
}

/** `Linking.parse`는 같은 키가 여러 번 오면 배열을 준다. 첫 값만 쓴다. */
function firstValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export interface OAuthLoginState {
  /** 진행 중인 제공자. 버튼 스피너와 중복 탭 차단에 쓴다. */
  pendingProvider: OAuthProvider | null;
  /** 실패 문구. 같은 화면에 그대로 노출하고 사용자가 다시 누르면 사라진다. */
  error: string | null;
  /**
   * 목업 모드 여부. 이때는 브라우저를 열지 않고 가짜로 성공하므로
   * 화면에 그 사실을 드러내야 한다 — 실제 연동이 안 되는 걸 성공으로 착각하기 쉽다.
   */
  isMocked: boolean;
  signIn: (provider: OAuthProvider) => void;
}

/**
 * 진행 중인 시도. 컴포넌트가 아니라 모듈에 두는 이유는 이 흐름이 앱 전역이기 때문이다.
 *
 * 브라우저에 다녀오는 동안 화면이 다시 마운트될 수 있고, App Link 복귀 화면
 * (`app/oauth/callback/[provider].tsx`)도 "지금 처리 중인 로그인이 있는지" 알아야 한다.
 */
let pendingProviderRef: OAuthProvider | null = null;

/**
 * 처리 중인 소셜 로그인이 있는지. App Link 복귀 화면이 자기 역할을 판단하는 데 쓴다.
 *
 * `false`면 앱이 종료된 상태에서 복귀한 것이다. 그때는 `state`가 메모리에서 사라졌으므로
 * 검증할 수단이 없고, 인가 코드를 그대로 서버에 넘기면 CSRF 검증을 스스로 포기하는 셈이다.
 */
export function isOAuthLoginInFlight(): boolean {
  return pendingProviderRef !== null;
}

/**
 * 카카오·네이버 소셜 로그인.
 *
 * 네이티브 SDK를 쓰지 않는다. 시스템 브라우저(Custom Tabs)로 인증을 마치고
 * Android App Link로 앱에 복귀한 뒤, 받아온 인가 코드를 백엔드에 넘겨 서비스 토큰으로 바꾼다.
 *
 * ```
 * 앱 → Custom Tabs → 카카오/네이버 → App Link 복귀(state 검증)
 *   → POST /api/v1/auth/oauth/{provider} → 홈 또는 온보딩
 * ```
 *
 * 목업 모드(`EXPO_PUBLIC_API_BASE_URL` 미설정)에서는 브라우저를 열지 않고
 * 고정 응답으로 온보딩까지 넘어간다. 콘솔 키 없이 화면 흐름을 볼 수 있게 하려는 것이다.
 */
export function useOAuthLogin(): OAuthLoginState {
  // 브라우저에 다녀오는 사이 화면이 다시 마운트되면 모듈 쪽 값이 진실이다.
  const [pendingProvider, setPendingProvider] = useState<OAuthProvider | null>(() => pendingProviderRef);
  const [error, setError] = useState<string | null>(null);
  const completeOAuthLogin = useAuthStore((state) => state.completeOAuthLogin);

  const signIn = useCallback(
    (provider: OAuthProvider) => {
      // 두 버튼을 연달아 누르면 나중 요청이 앞의 흐름을 덮어써 둘 다 실패한다.
      if (pendingProviderRef !== null) return;

      pendingProviderRef = provider;
      setPendingProvider(provider);
      setError(null);

      const finish = (message: string | null) => {
        pendingProviderRef = null;
        setPendingProvider(null);
        setError(message);
      };

      const goNext = (authStatus: 'AUTHENTICATED' | 'ONBOARDING_REQUIRED') => {
        pendingProviderRef = null;
        setPendingProvider(null);
        // replace로 이동해 뒤로 가기가 로그인 화면으로 돌아오지 않게 한다.
        router.replace(authStatus === 'AUTHENTICATED' ? '/(tabs)/home' : '/(onboarding)/age');
      };

      authorize(provider)
        .then((authorization) => {
          if (authorization === null) {
            // 사용자가 브라우저를 닫았다. 실패가 아니므로 문구를 남기지 않는다.
            finish(null);
            return null;
          }

          return signInWithOAuth(provider, authorization.code, authorization.state)
            .then(completeOAuthLogin)
            .then(goNext);
        })
        .catch((cause: unknown) => finish(toErrorMessage(cause)));
    },
    [completeOAuthLogin],
  );

  return { pendingProvider, error, isMocked: usesMockApi, signIn };
}

interface Authorization {
  code: string;
  state: string;
}

/**
 * 브라우저를 열어 인가 코드를 받아온다. 사용자가 닫으면 `null`.
 *
 * `state`는 이 함수 안에서만 살아 있는 값이다. 어긋나면 **백엔드를 부르지 않고**
 * 여기서 끊는다. 우리가 시작하지 않은 인가 코드를 서버에 넘기는 순간 그게 곧 CSRF이기 때문이다.
 */
async function authorize(provider: OAuthProvider): Promise<Authorization | null> {
  const state = createOAuthState();

  // 목업 모드에서는 콘솔 키도 App Link도 없으므로 브라우저 단계를 건너뛴다.
  if (usesMockApi) {
    return { code: 'mock-authorization-code', state };
  }

  if (!hasOAuthClientId(provider)) {
    throw new ApiError(0, 'OAUTH_CLIENT_ID_MISSING', '로그인 설정이 비어 있어요. 관리자에게 문의해 주세요');
  }

  const result = await WebBrowser.openAuthSessionAsync(
    buildAuthorizeUrl(provider, state),
    oauthRedirectUri(provider),
  );

  if (result.type !== 'success') {
    return null;
  }

  const { queryParams } = Linking.parse(result.url);
  const code = firstValue(queryParams?.code);
  const returnedState = firstValue(queryParams?.state);

  // 카카오·네이버 모두 실패하면 code 대신 error를 붙여 돌려보낸다.
  const providerError = firstValue(queryParams?.error);

  // 동의 화면에서 사용자가 직접 취소한 것은 실패가 아니다. 문구 없이 조용히 돌아온다.
  if (providerError === 'access_denied') {
    return null;
  }

  if (providerError !== null || code === null) {
    // 제공자가 준 코드를 문구에 남긴다. 콘솔 설정 오류는 이 값이 유일한 단서라
    // 버리면 화면만 보고는 원인을 좁힐 수 없다.
    throw new ApiError(
      401,
      'AUTH_OAUTH_FAILED',
      `${ERROR_MESSAGE.AUTH_OAUTH_FAILED} (${providerError ?? 'no_code'})`,
    );
  }

  if (returnedState !== state) {
    throw new ApiError(0, 'OAUTH_STATE_MISMATCH', '로그인 요청이 만료됐어요. 다시 시도해 주세요');
  }

  return { code, state: returnedState };
}
