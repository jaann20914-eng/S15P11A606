export type AsyncStatus = 'idle' | 'loading' | 'success' | 'error';

/**
 * 성공 응답 공통 봉투. 백엔드 `global/response/ApiResponse`와 형태를 맞춘다.
 * 데이터가 없는 응답은 `data`가 `null`이다.
 */
export type ApiResponse<T> = {
  statusCode: number;
  message: string;
  data: T;
};

export type CursorPage<T> = {
  items: T[];
  nextCursor: string | null;
};

/**
 * 오류 응답. 백엔드 `global/response/ErrorResponse`와 형태를 맞춘다.
 * 화면은 `error.code`로 분기하고 `message`는 사용자에게 그대로 노출할 수 있다.
 */
export type ErrorResponse = {
  statusCode: number;
  message: string;
  error: {
    code: string;
  };
};
