import { useEffect, useSyncExternalStore } from 'react';
import { getSocketStatus, retainSocket, subscribeToSocketStatus } from '@/api/chat/socket/client';
import type { SocketStatus } from '@/types/chatSocket';

/**
 * 이 화면이 있는 동안 채팅 소켓을 열어 둔다.
 *
 * 채팅 영역의 화면마다 부르면 된다. 여러 화면이 겹쳐 있어도 연결은 하나고, 마지막 화면이
 * 내려갈 때 끊긴다(`retainSocket`). 화면을 옮길 때 연결이 끊겼다 붙는 일이 없다.
 */
export function useChatSocket(): SocketStatus {
  useEffect(() => retainSocket(), []);

  return useSocketStatus();
}

/** 연결 상태만 본다. 연결을 붙잡지는 않는다. */
export function useSocketStatus(): SocketStatus {
  return useSyncExternalStore(subscribeToSocketStatus, getSocketStatus, getSocketStatus);
}
