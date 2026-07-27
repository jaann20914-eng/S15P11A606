import type { ApiResponse, ErrorResponse } from '@/types/common';

const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

/** 액세스 토큰을 반환한다. 없으면 null. */
type TokenProvider = () => string | null;

let provideAccessToken: TokenProvider = () => null;

/**
 * 액세스 토큰 공급자를 등록한다. 인증 스토어가 준비되면 앱 시작 시 한 번 호출한다.
 * 요청 시점에 매번 다시 읽으므로 토큰이 갱신돼도 별도 처리가 필요 없다.
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

/** 오류 응답 본문을 파싱한다. 규격에 맞지 않으면 상태 코드만으로 예외를 만든다. */
async function toApiError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as ErrorResponse;
    return new ApiError(body.statusCode, body.error.code, body.message);
  } catch {
    return new ApiError(response.status, 'UNKNOWN_ERROR', '잠시 후 다시 시도해 주세요');
  }
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<ApiResponse<T>> {
  if (!apiBaseUrl) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL이 설정되지 않았어요');
  }

  const accessToken = provideAccessToken();

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw await toApiError(response);
  }

  return response.json() as Promise<ApiResponse<T>>;
}
