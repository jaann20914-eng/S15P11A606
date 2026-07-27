export type AsyncStatus = 'idle' | 'loading' | 'success' | 'error';

export type ApiResponse<T> = {
  data: T;
  message?: string;
};

export type CursorPage<T> = {
  items: T[];
  nextCursor: string | null;
};

export type ErrorResponse = {
  code: string;
  message: string;
};
