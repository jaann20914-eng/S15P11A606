import { setAccessTokenProvider } from '@/api/client';
import { createStore } from './createStore';

/**
 * 로그인 세션.
 *
 * 토큰은 메모리에만 둔다. 저장소 라이브러리가 아직 없어 앱을 다시 켜면 세션은 사라지고,
 * 그때는 진입점이 다시 로그인으로 보낸다. 저장소가 들어오면 이 파일만 바꾸면 된다.
 *
 * 로그인 화면은 토큰을 받은 뒤 `setSession`을 부르고, 로그아웃은 `clearSession`을 부른다.
 */

export interface SessionState {
  accessToken: string | null;
  refreshToken: string | null;
  /** 로그인 성공 시 받은 토큰을 담는다. */
  setSession: (tokens: { accessToken: string; refreshToken: string }) => void;
  /** 세션을 비운다. 이후 요청에는 `Authorization` 헤더가 붙지 않는다. */
  clearSession: () => void;
}

export const useSessionStore = createStore<SessionState>((set) => ({
  accessToken: null,
  refreshToken: null,
  setSession: ({ accessToken, refreshToken }) => set({ accessToken, refreshToken }),
  clearSession: () => set({ accessToken: null, refreshToken: null }),
}));

/**
 * 요청 인터셉터가 토큰을 읽을 곳을 알려 준다.
 *
 * 인터셉터는 요청마다 다시 읽으므로 한 번만 등록하면 토큰이 바뀌어도 그대로 따라간다.
 * 세션을 비우면 곧바로 `null`이 되어 헤더가 사라진다.
 */
setAccessTokenProvider(() => useSessionStore.getState().accessToken);
