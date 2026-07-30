import axios, { AxiosHeaders } from 'axios';
import type { AxiosError, AxiosInstance, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';
import { apiBaseUrl } from '@/constants/env';
import type { ApiResponse, ErrorResponse } from '@/types/common';

/** 액세스 토큰을 반환한다. 없으면 null. */
type TokenProvider = () => string | null;

/** 토큰을 재발급하고 새 accessToken을 돌려준다. 실패하면 던진다. */
type TokenRefresher = () => Promise<string>;

let provideAccessToken: TokenProvider = () => null;
let provideOnboardingToken: TokenProvider = () => null;
let refreshAccessToken: TokenRefresher | null = null;

/**
 * 액세스 토큰 공급자를 등록한다. 인증 스토어가 준비되면 앱 시작 시 한 번 호출한다.
 * 요청 인터셉터가 매번 다시 읽으므로 토큰이 갱신돼도 별도 처리가 필요 없다.
 */
export function setAccessTokenProvider(provider: TokenProvider): void {
  provideAccessToken = provider;
}

/**
 * 온보딩 토큰 공급자를 등록한다. 온보딩 완료 API만 이 토큰을 쓴다.
 * 온보딩이 끝나면 스토어가 값을 비우므로 이후에는 자연히 붙지 않는다.
 */
export function setOnboardingTokenProvider(provider: TokenProvider): void {
  provideOnboardingToken = provider;
}

/**
 * 토큰 재발급 함수를 등록한다. 등록 전에는 401을 그대로 던진다.
 *
 * 스토어를 직접 import하지 않는 이유는 순환 참조 때문이다 —
 * `useAuthStore`는 재발급 API를 부르려고 이 파일을 이미 참조한다.
 */
export function setTokenRefresher(refresher: TokenRefresher): void {
  refreshAccessToken = refresher;
}

/**
 * 인증 엔드포인트는 토큰 흐름 밖에 있다.
 *
 * - 만료된 accessToken을 붙여 보낼 이유가 없다
 * - 로그인 실패(401 `AUTH_OAUTH_FAILED`)나 재발급 실패(401 `INVALID_REFRESH_TOKEN`)에
 *   재발급을 또 걸면 무한 루프가 된다
 */
function isAuthEndpoint(url: string | undefined): boolean {
  return url?.startsWith('/api/v1/auth/') ?? false;
}

/**
 * 온보딩 완료 API는 `purpose: "ONBOARDING"` 토큰만 받는다.
 *
 * 일반 accessToken을 붙이면 서버가 `purpose` 불일치로 거부하므로 경로로 구분한다.
 * 401도 재발급 대상이 아니다 — 온보딩 토큰은 재발급 수단이 없고 일회성이라
 * 무효면 소셜 로그인부터 다시 해야 한다.
 */
function isOnboardingEndpoint(url: string | undefined): boolean {
  return url?.startsWith('/api/v1/onboarding') ?? false;
}

/**
 * 이 요청에 붙일 토큰을 고른다.
 *
 * 토큰과 엔드포인트의 대응은 보안 규칙이라 호출부에 흩지 않고 여기 한 곳에서 정한다.
 * 덕분에 도메인 모듈은 `apiRequest`만 쓰면 되고 토큰 종류를 알 필요가 없다.
 */
function resolveToken(url: string | undefined): string | null {
  if (isAuthEndpoint(url)) return null;
  if (isOnboardingEndpoint(url)) return provideOnboardingToken();
  return provideAccessToken();
}

/** 401을 재발급으로 회복할 수 있는 요청인지. 인증·온보딩 경로는 대상이 아니다. */
function allowsTokenRefresh(url: string | undefined): boolean {
  return !isAuthEndpoint(url) && !isOnboardingEndpoint(url);
}

/** 재발급 후 한 번만 재시도하도록 표시한 요청 설정. */
type RetriableConfig = InternalAxiosRequestConfig & { retriedAfterRefresh?: boolean };

/**
 * 서버가 내려준 오류 코드를 그대로 담는 예외.
 * 화면은 `code`로 분기하고, 사용자에게는 `message`를 보여준다.
 */
export class ApiError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
    // Hermes에서 Error 상속 시 instanceof가 깨지는 경우를 막는다.
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

/** 응답 자체를 받지 못했을 때(연결 실패·타임아웃) 쓰는 코드. 서버가 준 값이 아니다. */
export const NETWORK_ERROR_CODE = 'NETWORK_ERROR';
/** 응답은 왔지만 오류 규격과 다를 때 쓰는 코드. */
export const UNKNOWN_ERROR_CODE = 'UNKNOWN_ERROR';

/**
 * axios 오류를 `ApiError`로 바꾼다.
 *
 * 백엔드는 실패 시 `{ statusCode, message, error: { code } }`를 준다.
 * 그 규격이 아니면(프록시 오류, 타임아웃 등) 상태 코드만으로 만든다.
 */
function toApiError(error: AxiosError<ErrorResponse>): ApiError {
  const response = error.response;

  if (!response) {
    return new ApiError(0, NETWORK_ERROR_CODE, '네트워크 연결을 확인해 주세요');
  }

  const body = response.data;
  if (body?.error?.code) {
    return new ApiError(body.statusCode ?? response.status, body.error.code, body.message);
  }

  return new ApiError(response.status, UNKNOWN_ERROR_CODE, '잠시 후 다시 시도해 주세요');
}

/**
 * 공용 axios 인스턴스.
 *
 * 인터셉터가 세 가지를 맡는다.
 * - 요청: 경로에 맞는 토큰을 골라 `Authorization` 헤더를 붙인다(`resolveToken`)
 * - 응답: 401이면 토큰을 재발급해 한 번 재시도한다(인증·온보딩 경로는 제외)
 * - 응답: 남은 오류를 전부 `ApiError`로 바꿔 화면이 axios를 몰라도 되게 한다
 */
export const httpClient: AxiosInstance = axios.create({
  baseURL: apiBaseUrl,
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
});

httpClient.interceptors.request.use((config) => {
  const token = resolveToken(config.url);
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

httpClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ErrorResponse>) => {
    const apiError = toApiError(error);
    const config = error.config as RetriableConfig | undefined;
    const refresh = refreshAccessToken;

    if (
      apiError.statusCode !== 401 ||
      refresh === null ||
      config === undefined ||
      config.retriedAfterRefresh ||
      !allowsTokenRefresh(config.url)
    ) {
      throw apiError;
    }

    // 재시도 표시를 먼저 남긴다. 재발급 후에도 401이면 두 번째 재시도 없이 오류로 끝난다.
    config.retriedAfterRefresh = true;

    // 여러 요청이 동시에 401을 맞아도 스토어가 프라미스를 하나로 합치므로
    // 실제 재발급 호출은 한 번만 나가고, 나머지는 여기서 함께 기다린다.
    // 재발급이 실패하면 그 오류(`INVALID_REFRESH_TOKEN` 등)가 그대로 호출부까지 올라간다.
    const accessToken = await refresh();

    // 요청 인터셉터가 다시 붙여주지만, 대기 중에 토큰이 또 바뀌는 경우를 피해
    // 방금 받은 값을 직접 얹는다.
    const headers = new AxiosHeaders(config.headers);
    headers.set('Authorization', `Bearer ${accessToken}`);

    return httpClient.request({ ...config, headers });
  },
);

/**
 * 공용 응답 봉투(`{ statusCode, message, data }`)를 벗겨 `data`만 돌려준다.
 *
 * 실패는 인터셉터가 이미 `ApiError`로 바꿔 두었으므로 호출부는 그대로 던지면 된다.
 */
export async function apiRequest<T>(config: AxiosRequestConfig): Promise<T> {
  if (!apiBaseUrl) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL이 설정되지 않았어요');
  }

  const response = await httpClient.request<ApiResponse<T>>(config);
  return response.data.data;
}
