import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { createStore } from './createStore';
import { ApiError } from '@/api/client';
import { usesMockApi } from '@/api/config';
import { refreshTokenPair } from '@/api/auth/refresh';
import type { AuthStatus, OAuthLoginResult, TokenPair } from '@/types/auth';

/**
 * 인증 상태 단일 소스.
 *
 * 토큰을 어디에 두는지가 이 파일의 핵심이다.
 * - `accessToken`: 메모리 + secure store. 매 요청에 붙이므로 동기 접근이 필요하다.
 * - `refreshToken`: **secure store에만** 둔다. 상태로 노출하지 않는 건 RTR 때문이다 —
 *   재발급마다 값이 바뀌는데 메모리 사본이 있으면 어느 쪽이 최신인지 헷갈릴 여지가 생긴다.
 *   쓸 일이 재발급 한 곳뿐이라 그때 읽으면 충분하다.
 * - `onboardingToken`: 메모리에만 둔다. 온보딩을 끝내면 버리는 값이고,
 *   앱을 껐다 켜면 소셜 로그인부터 다시 하는 게 맞다.
 */

const ACCESS_TOKEN_KEY = 'auth.accessToken';
const REFRESH_TOKEN_KEY = 'auth.refreshToken';

export interface AuthState {
  /** secure store 복원이 끝났는지. 끝나기 전에 화면을 분기하면 로그인 상태가 잠깐 깜빡인다. */
  hydrated: boolean;
  authStatus: AuthStatus;
  accessToken: string | null;
  /**
   * 온보딩 전용 토큰. `purpose: "ONBOARDING"`을 담고 있어
   * 일반 서비스 API(`purpose: "ACCESS"` 요구)에는 절대 쓰면 안 된다.
   * 그래서 `httpClient`는 이 값을 쳐다보지 않고 `accessToken`만 헤더에 붙인다.
   */
  onboardingToken: string | null;
  hydrate: () => Promise<void>;
  /** 반영한 상태를 돌려준다. 호출부가 그 값으로 다음 화면을 고른다. */
  completeOAuthLogin: (result: OAuthLoginResult) => Promise<OAuthLoginResult['authStatus']>;
  completeOnboarding: (tokens: TokenPair) => Promise<void>;
  refreshAccessToken: () => Promise<string>;
  signOut: () => Promise<void>;
}

/**
 * 재발급을 되돌릴 수 없게 만드는 오류들.
 *
 * 이 코드가 오면 손에 든 refreshToken은 이미 무효라 재시도가 의미 없다.
 * 반대로 500(`TOKEN_REFRESH_FAILED`)이나 네트워크 실패는 토큰이 아직 살아 있으므로
 * 세션을 지우지 않는다. 일시적인 서버 장애로 로그아웃시키는 건 과한 처리다.
 */
const TERMINAL_REFRESH_CODES = new Set([
  'REFRESH_TOKEN_REQUIRED',
  'INVALID_REFRESH_TOKEN',
  'REFRESH_TOKEN_REUSED',
]);

/**
 * 토큰을 기기에 남길지.
 *
 * 두 경우에 남기지 않고 메모리만 쓴다.
 *
 * **웹**: `expo-secure-store`의 웹 모듈은 빈 객체라 호출하면 예외가 난다. 안드로이드 우선
 * 프로젝트에서 웹은 화면 확인용이므로 저장을 건너뛴다 — **localStorage로 대체하지 않는다.**
 * 토큰을 안전하지 않은 곳에 두는 절충은 하지 않는다. 그래서 웹에서는 새로고침하면 로그인이 풀린다.
 *
 * **목업 모드**: 시연용이라 **켤 때마다 로그인 화면부터 보여야 한다.** 남기면 한 번 온보딩을
 * 끝낸 뒤로는 `hydrate`가 그 토큰을 읽어 `AUTHENTICATED`가 되고, `app/index.tsx`가 곧바로
 * 홈으로 보낸다 — 목업 안내문이 붙은 로그인 화면과 온보딩을 다시 볼 수 없다. 실서버로 한 번
 * 로그인해 둔 세션이 목업 모드에서 되살아나는 문제도 같은 뿌리다.
 *
 * 가치가 없는 값이라 남길 이유도 없다. 이미 `onboardingToken`을 메모리에만 두는 것과 같은
 * 판단이다 — 앱을 껐다 켜면 소셜 로그인부터 다시 하는 게 맞다.
 *
 * 목업 모드에서는 어떤 요청도 네트워크를 타지 않으므로(`usesMock`이 모든 모듈에 참을 준다)
 * 401도, 재발급도 일어나지 않는다. 저장된 refreshToken이 없어도 걸릴 곳이 없다.
 */
const canPersistTokens = Platform.OS !== 'web' && !usesMockApi;

async function persistTokens({ accessToken, refreshToken }: TokenPair): Promise<void> {
  if (!canPersistTokens) return;

  await Promise.all([
    SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken),
    SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken),
  ]);
}

async function readPersistedTokens(): Promise<[string | null, string | null]> {
  if (!canPersistTokens) return [null, null];

  return Promise.all([
    SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
  ]);
}

async function clearPersistedTokens(): Promise<void> {
  if (!canPersistTokens) return;

  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
  ]);
}

/**
 * 진행 중인 재발급. 동시에 여러 요청이 401을 맞아도 호출은 한 번만 나가게 한다.
 *
 * RTR이라 두 번 나가면 두 번째 요청은 이미 폐기된 토큰을 들고 가 `REFRESH_TOKEN_REUSED`가 되고,
 * 서버는 이를 탈취로 보고 세션 전체를 끊는다. 즉 "동시성 버그 = 강제 로그아웃"이다.
 * 뒤늦게 온 요청들은 이 프라미스를 함께 기다렸다가 새 accessToken을 나눠 쓴다.
 */
let pendingRefresh: Promise<string> | null = null;

export const useAuthStore = createStore<AuthState>((set) => ({
  hydrated: false,
  authStatus: 'UNAUTHENTICATED',
  accessToken: null,
  onboardingToken: null,

  /**
   * 앱 시작 시 저장된 세션을 되살린다.
   *
   * 판단 기준은 refreshToken이다. accessToken은 만료됐을 수 있지만
   * 그건 401 한 번으로 회복되므로 로그인 화면까지 되돌릴 이유가 없다.
   */
  hydrate: async () => {
    try {
      const [accessToken, refreshToken] = await readPersistedTokens();

      set({
        hydrated: true,
        accessToken,
        authStatus: refreshToken ? 'AUTHENTICATED' : 'UNAUTHENTICATED',
      });
    } catch {
      // secure store를 읽지 못하면(기기 잠금 해제 전 등) 로그인부터 다시 시작한다.
      set({ hydrated: true, accessToken: null, authStatus: 'UNAUTHENTICATED' });
    }
  },

  /**
   * 소셜 로그인 응답을 상태에 반영하고 이동할 곳을 알려준다.
   *
   * 분기는 서버가 준 `authStatus`만 본다. 신규 회원이든 온보딩을 중간에 그만둔
   * 기존 회원이든 서버가 같은 값으로 내려주기 때문에 앱이 따로 판단할 게 없다.
   */
  completeOAuthLogin: async (result) => {
    if (result.authStatus === 'AUTHENTICATED') {
      await persistTokens(result);
      set({
        authStatus: 'AUTHENTICATED',
        accessToken: result.accessToken,
        onboardingToken: null,
      });
      return 'AUTHENTICATED';
    }

    set({
      authStatus: 'ONBOARDING_REQUIRED',
      accessToken: null,
      onboardingToken: result.onboardingToken,
    });
    return 'ONBOARDING_REQUIRED';
  },

  /**
   * 온보딩 완료 응답으로 받은 서비스 토큰으로 갈아탄다.
   * `onboardingToken`은 여기서 버려야 이후 요청에 섞여 들어갈 일이 없다.
   */
  completeOnboarding: async (tokens) => {
    await persistTokens(tokens);
    set({
      authStatus: 'AUTHENTICATED',
      accessToken: tokens.accessToken,
      onboardingToken: null,
    });
  },

  /**
   * accessToken을 재발급한다. 동시 호출은 하나로 합친다.
   *
   * 성공하면 새 accessToken을 돌려주고, 되돌릴 수 없는 실패면 세션을 지운 뒤 던진다.
   * 어느 쪽이든 호출부(`httpClient` 인터셉터)는 재시도 여부만 판단하면 된다.
   */
  refreshAccessToken: () => {
    pendingRefresh ??= runRefresh().finally(() => {
      pendingRefresh = null;
    });

    return pendingRefresh;
  },

  signOut: async () => {
    await clearPersistedTokens();
    set({ authStatus: 'UNAUTHENTICATED', accessToken: null, onboardingToken: null });
  },
}));

async function runRefresh(): Promise<string> {
  // 보안 저장소가 없는 환경(웹)에서는 항상 null이라 곧바로 로그아웃 경로를 탄다.
  const [, refreshToken] = await readPersistedTokens();

  if (!refreshToken) {
    await useAuthStore.getState().signOut();
    throw new ApiError(400, 'REFRESH_TOKEN_REQUIRED', '다시 로그인해 주세요');
  }

  try {
    const renewed = await refreshTokenPair(refreshToken);
    // RTR: 응답의 refreshToken까지 저장해야 다음 재발급이 성공한다.
    await persistTokens(renewed);
    useAuthStore.setState({ accessToken: renewed.accessToken, authStatus: 'AUTHENTICATED' });
    return renewed.accessToken;
  } catch (cause) {
    if (cause instanceof ApiError && TERMINAL_REFRESH_CODES.has(cause.code)) {
      await useAuthStore.getState().signOut();
    }
    throw cause;
  }
}
