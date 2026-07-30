import { useCallback, useState } from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { ApiError, NETWORK_ERROR_CODE } from '@/api/client';
import { usesMockApi } from '@/api/config';
import { signInWithOAuth } from '@/api/auth/oauth';
import { useAuthStore } from '@/store/useAuthStore';
import {
  acceptedRedirectPrefixes,
  buildAuthorizeUrl,
  createOAuthState,
  hasOAuthClientId,
  oauthRedirectUri,
} from '@/utils/oauth';
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

/**
 * 개발 중 로그인 흐름을 터미널에서 추적한다. 배포 빌드에서는 아무것도 하지 않는다.
 *
 * 이 흐름은 앱을 벗어나 브라우저를 거쳐 돌아오기 때문에 어디서 끊겼는지 화면만으로는 알 수 없다.
 * 브라우저에서 끊기면 복귀 자체가 없어서 `result.type`만이 단서다.
 *
 * **인가 코드와 토큰은 절대 그대로 찍지 않는다.** 코드는 짧게 살아 있어도 계정을 넘겨받을 수 있는
 * 값이고, 로그는 팀원 간에 그대로 복사돼 돌아다닌다. 길이와 앞 6자만 남겨 동일성만 확인한다.
 */
function logOAuth(step: string, detail?: Record<string, unknown>): void {
  if (!__DEV__) return;
  console.log(`[oauth] ${step}`, detail ?? '');
}

/** 민감한 값을 동일성 확인용으로만 줄인다. */
function mask(value: string | null): string {
  if (value === null) return 'null';
  return `${value.slice(0, 6)}…(${value.length}자)`;
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
  /**
   * 이 환경에서 실제 로그인이 원리적으로 불가능한지.
   *
   * 복귀 수단이 Android App Link뿐이라 안드로이드 기기(개발 빌드) 밖에서는 완주할 수 없다.
   * 웹에서는 리다이렉트가 앱으로 오지 않고 서버 404 페이지를 그대로 띄운다.
   */
  platformUnsupported: boolean;
  signIn: (provider: OAuthProvider) => void;
}

/**
 * 실제 로그인을 완주할 수 있는 환경인지.
 *
 * 목업 모드는 브라우저를 아예 열지 않으므로 플랫폼과 무관하게 동작한다.
 * 그 외에는 App Link가 있는 안드로이드만 가능하다 — 웹에서 시험하면 카카오는
 * 서버 404로 끝나고, 네이버는 시작 URL(localhost)이 미등록이라 거부한다.
 */
const PLATFORM_UNSUPPORTED = !usesMockApi && Platform.OS !== 'android';

const PLATFORM_UNSUPPORTED_MESSAGE =
  '소셜 로그인은 안드로이드 개발 빌드에서만 동작해요 (복귀 경로가 App Link이기 때문이에요)';

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

      // 화면이 버튼을 잠그지만, 여기서도 막아 브라우저가 헛되이 열리지 않게 한다.
      if (PLATFORM_UNSUPPORTED) {
        logOAuth('중단 — 지원하지 않는 환경', { platform: Platform.OS });
        setError(PLATFORM_UNSUPPORTED_MESSAGE);
        return;
      }

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
        logOAuth('완료 — 화면 이동', { authStatus });
        // replace로 이동해 뒤로 가기가 로그인 화면으로 돌아오지 않게 한다.
        router.replace(authStatus === 'AUTHENTICATED' ? '/(tabs)/home' : '/(onboarding)/age');
      };

      logOAuth('시작', { provider, mock: usesMockApi, redirectUri: oauthRedirectUri(provider) });

      authorize(provider)
        .then((authorization) => {
          if (authorization === null) {
            // 사용자가 브라우저를 닫았다. 실패가 아니므로 문구를 남기지 않는다.
            logOAuth('사용자가 중단 — 문구 없이 종료');
            finish(null);
            return null;
          }

          logOAuth('백엔드 호출', { url: `POST /api/v1/auth/oauth/${provider}` });

          return signInWithOAuth(provider, authorization.code, authorization.state)
            .then((result) => {
              logOAuth('백엔드 응답', { authStatus: result.authStatus });
              return completeOAuthLogin(result);
            })
            .then(goNext);
        })
        .catch((cause: unknown) => {
          if (cause instanceof ApiError) {
            logOAuth('실패', { code: cause.code, statusCode: cause.statusCode, message: cause.message });
          } else {
            logOAuth('실패(예상 외)', { cause: String(cause) });
          }
          finish(toErrorMessage(cause));
        });
    },
    [completeOAuthLogin],
  );

  return {
    pendingProvider,
    error,
    isMocked: usesMockApi,
    platformUnsupported: PLATFORM_UNSUPPORTED,
    signIn,
  };
}

interface Authorization {
  code: string;
  state: string;
}

/**
 * `dismiss`를 받은 뒤 복귀 URL을 더 기다리는 시간(ms).
 *
 * 안드로이드에는 네이티브 AuthSession이 없어 `openAuthSessionAsync`가 폴리필로 돈다.
 * 그 폴리필은 **AppState가 `active`가 되는 것**과 **Linking url 이벤트**를 `Promise.race`한다.
 * App Link로 앱이 열리면 둘이 거의 동시에 발생하고, AppState가 이기면 결과가 `dismiss`가 되면서
 * **복귀 URL이 그대로 버려진다.** 그러면 인가 코드를 받았는데도 로그인이 조용히 실패한다.
 *
 * 그래서 우리도 직접 듣고, `dismiss`를 받아도 이 시간만큼 URL을 더 기다린다.
 * 진짜 취소일 때만 이만큼 늦어지므로 대기 비용은 이쪽이 싸다.
 */
const REDIRECT_GRACE_MS = 1000;

/**
 * 이 시간보다 오래 브라우저에 머물렀는데 복귀가 없으면 사용자에게 실패를 알린다.
 *
 * 곧바로 뒤로 나온 것은 취소이므로 조용히 끝내는 게 맞다. 하지만 한참 머문 뒤 아무 일도
 * 일어나지 않으면, 그건 사용자가 인증을 시도했는데 앱이 결과를 받지 못한 것이다.
 * 이때 화면을 그대로 두면 "버튼이 먹통"으로만 보인다.
 */
const SILENT_CANCEL_LIMIT_MS = 5000;

/** 복귀 URL을 받았는지, 못 받았다면 얼마나 머물렀는지. */
type RedirectOutcome = { url: string } | { url: null; dwellMs: number };

/** Chrome의 Android 패키지명. */
const CHROME_PACKAGE = 'com.android.chrome';

/**
 * Custom Tab을 열 브라우저를 고른다. 고르지 못하면 `undefined`(기본 브라우저).
 *
 * 기기 기본 브라우저가 무엇이냐에 따라 복귀 처리가 달라진다 — 갤럭시는 삼성 인터넷이
 * 기본인 경우가 많고, 그쪽 Custom Tab은 App Link나 커스텀 스킴 인텐트를 Chrome과 다르게
 * 다룰 수 있다. 그래서 Chrome이 있으면 Chrome으로 고정해 기기별 편차를 줄인다.
 *
 * 판단 기준은 `servicePackages`다. Custom Tab을 띄우는 데 필요한 것은 Custom Tabs **서비스**
 * 지원이고, `browserPackages`는 일반 VIEW 인텐트를 처리하는 브라우저 목록이라 성격이 다르다.
 * 실제로 노트20에서는 Chrome이 `servicePackages`에만 있었는데, 그 이유로 Chrome을 건너뛰고
 * 삼성 인터넷으로 열려 복귀가 앱에 전달되지 않았다.
 */
async function resolveBrowserPackage(): Promise<string | undefined> {
  try {
    const result = await WebBrowser.getCustomTabsSupportingBrowsersAsync();

    logOAuth('Custom Tab 브라우저', {
      기본: result.defaultBrowserPackage ?? 'none',
      선호: result.preferredBrowserPackage ?? 'none',
      브라우저: result.browserPackages,
      서비스: result.servicePackages,
    });

    return result.servicePackages.includes(CHROME_PACKAGE) ? CHROME_PACKAGE : undefined;
  } catch (cause) {
    // 조회에 실패하면 기본 브라우저로 진행한다. 진단용이라 흐름을 막지 않는다.
    logOAuth('브라우저 조회 실패 — 기본 브라우저 사용', { cause: String(cause) });
    return undefined;
  }
}

/**
 * 브라우저를 열고 복귀 URL을 받아온다.
 *
 * `openAuthSessionAsync`의 결과에만 기대지 않는다(위 `REDIRECT_GRACE_MS` 설명 참고).
 * 리스너를 **브라우저를 열기 전에** 등록해 두어야 복귀가 빨라도 놓치지 않는다.
 *
 * `accepted`에는 https(App Link)와 커스텀 스킴이 함께 들어온다. 어느 쪽으로 와도 처리하므로
 * 백엔드가 커스텀 스킴 302를 넣기 전과 후에 코드가 달라지지 않는다.
 */
async function openBrowserAndAwaitRedirect(
  authorizeUrl: string,
  redirectUri: string,
  accepted: string[],
): Promise<RedirectOutcome> {
  // 클로저에서 채우는 값이라 객체에 담는다. 지역 변수로 두면 좁혀진 타입이 풀리지 않는다.
  const captured: { url: string | null } = { url: null };
  let notify: ((url: string) => void) | null = null;

  const subscription = Linking.addEventListener('url', ({ url }) => {
    if (!accepted.some((prefix) => url.startsWith(prefix))) {
      logOAuth('무관한 딥링크 무시', { url });
      return;
    }
    captured.url = url;
    notify?.(url);
  });

  const openedAt = Date.now();

  try {
    const browserPackage = await resolveBrowserPackage();
    logOAuth('브라우저 열기', { authorizeUrl, browserPackage: browserPackage ?? '기본' });

    const result = await WebBrowser.openAuthSessionAsync(authorizeUrl, redirectUri, {
      browserPackage,
    });

    // 머문 시간으로 "곧바로 뒤로 나감"과 "로그인까지 마쳤는데 복귀가 없음"을 구분한다.
    // 후자는 App Link 검증 문제이고, 전자는 그냥 사용자가 그만둔 것이다.
    logOAuth('브라우저 종료', { type: result.type, 머문시간: `${Date.now() - openedAt}ms` });

    if (result.type === 'success') {
      return { url: result.url };
    }

    // 이미 도착해 있었거나, 곧 도착할 수 있다.
    const url =
      captured.url ??
      (await new Promise<string | null>((resolve) => {
        const timer = setTimeout(() => resolve(null), REDIRECT_GRACE_MS);
        notify = (value) => {
          clearTimeout(timer);
          resolve(value);
        };
      }));

    if (url !== null) {
      logOAuth('AppState가 race를 이겼지만 복귀 URL은 직접 받았다', { type: result.type });
      return { url };
    }

    return { url: null, dwellMs: Date.now() - openedAt };
  } finally {
    notify = null;
    subscription.remove();
  }
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

  const redirectUri = oauthRedirectUri(provider);
  const outcome = await openBrowserAndAwaitRedirect(
    buildAuthorizeUrl(provider, state),
    redirectUri,
    acceptedRedirectPrefixes(provider),
  );

  if (outcome.url === null) {
    logOAuth('복귀 URL 없음', { dwellMs: outcome.dwellMs });

    // 곧바로 나온 건 취소다. 오래 머문 뒤라면 인증을 시도했는데 결과가 오지 않은 것이므로
    // 조용히 넘기면 버튼이 먹통인 것처럼 보인다.
    if (outcome.dwellMs >= SILENT_CANCEL_LIMIT_MS) {
      throw new ApiError(0, 'OAUTH_REDIRECT_NOT_RECEIVED', '로그인 결과를 받지 못했어요. 다시 시도해 주세요');
    }

    return null;
  }

  const { queryParams } = Linking.parse(outcome.url);
  const code = firstValue(queryParams?.code);
  const returnedState = firstValue(queryParams?.state);

  // 카카오·네이버 모두 실패하면 code 대신 error를 붙여 돌려보낸다.
  const providerError = firstValue(queryParams?.error);

  logOAuth('복귀 파라미터', {
    파라미터: Object.keys(queryParams ?? {}),
    code: mask(code),
    stateMatched: returnedState === state,
    error: providerError ?? 'none',
  });

  // 동의 화면에서 사용자가 직접 취소한 것은 실패가 아니다. 문구 없이 조용히 돌아온다.
  if (providerError === 'access_denied') {
    logOAuth('사용자가 동의를 거부');
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
