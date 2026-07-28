import axios from 'axios';
import type { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';
import type { ApiResponse, ErrorResponse } from '@/types/common';

const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

/** 액세스 토큰을 반환한다. 없으면 null. */
type TokenProvider = () => string | null;

let provideAccessToken: TokenProvider = () => null;

/**
 * 액세스 토큰 공급자를 등록한다. 인증 스토어가 준비되면 앱 시작 시 한 번 호출한다.
 * 요청 인터셉터가 매번 다시 읽으므로 토큰이 갱신돼도 별도 처리가 필요 없다.
 */
export function setAccessTokenProvider(provider: TokenProvider): void {
  provideAccessToken = provider;
}

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
 * 인터셉터가 두 가지를 맡는다.
 * - 요청: 액세스 토큰이 있으면 `Authorization` 헤더를 붙인다
 * - 응답: 오류를 전부 `ApiError`로 바꿔 화면이 axios를 몰라도 되게 한다
 */
export const httpClient: AxiosInstance = axios.create({
  baseURL: apiBaseUrl,
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
});

httpClient.interceptors.request.use((config) => {
  const accessToken = provideAccessToken();
  if (accessToken) {
    config.headers.set('Authorization', `Bearer ${accessToken}`);
  }
  return config;
});

httpClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ErrorResponse>) => Promise.reject(toApiError(error)),
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
