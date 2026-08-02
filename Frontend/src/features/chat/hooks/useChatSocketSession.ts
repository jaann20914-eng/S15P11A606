import { useEffect } from 'react';
import { retainSocket } from '@/api/chat/socket/client';
import { useAuthStore } from '@/store/useAuthStore';

/**
 * 로그인해 있는 동안 채팅 소켓을 열어 둔다. 루트 레이아웃에서 한 번만 쓴다.
 *
 * 연결 명세는 "채팅 탭에 들어오면 연결, 벗어나면 종료"지만 그러면 다른 탭에 있는 동안 새
 * 메시지나 채팅 요청을 알 방법이 없다. 알림을 실시간으로 받으려면 앱이 떠 있는 내내 연결이
 * 있어야 해서 범위를 넓혔다.
 *
 * 그래도 앱이 백그라운드로 가면 소켓은 끊긴다 — 그건 연결 시점을 바꿔서 해결되지 않고
 * 푸시(FCM)가 필요하다. 여기서 얻는 것은 "앱을 보고 있는 동안에는 어느 화면에서든 실시간"
 * 까지다.
 *
 * 온보딩 중에는 열지 않는다. 그때는 `purpose: ONBOARDING` 토큰만 있고 서비스용 액세스
 * 토큰이 없어, 붙어 봐야 서버가 거절한다.
 */
export function useChatSocketSession(): void {
  const authStatus = useAuthStore((state) => state.authStatus);

  useEffect(() => {
    if (authStatus !== 'AUTHENTICATED') return;

    return retainSocket();
  }, [authStatus]);
}
