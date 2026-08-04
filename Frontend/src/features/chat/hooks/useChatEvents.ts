import { useEffect, useRef } from 'react';
import { subscribeDestination } from '@/api/chat/socket/client';
import {
  USER_CHAT_ROOMS_QUEUE,
  USER_CHAT_ROOMS_SUBSCRIPTION_ID,
  USER_ERRORS_QUEUE,
  USER_ERRORS_SUBSCRIPTION_ID,
  chatRoomSubscriptionId,
  chatRoomTopic,
} from '@/api/chat/socket/destinations';
import type { ChatRoomEvent, SubscriptionFailedEvent, UserChatEvent } from '@/types/chatSocket';
import { createDevLogger } from '@/utils/devLog';

const log = createDevLogger('chat-socket');

/**
 * 사용자 전용 채팅방 목록 이벤트를 듣는다.
 *
 * 방에 매이지 않으므로 채팅 영역에 있는 동안 계속 열어 둔다. 목록 화면이 이 이벤트로
 * 마지막 메시지·안 읽음·상태를 갱신한다.
 */
export function useUserChatEvents(onEvent: (event: UserChatEvent) => void): void {
  useJsonSubscription<UserChatEvent>(USER_CHAT_ROOMS_SUBSCRIPTION_ID, USER_CHAT_ROOMS_QUEUE, (event) => {
    /*
      도착한 것을 남긴다. 이 로그가 없으면 "이벤트가 오지 않았다"와 "왔는데 목록에 반영되지
      않았다"를 가릴 수 없다 — 둘 다 화면에서는 똑같이 아무 일도 일어나지 않은 것으로 보인다.
    */
    log('목록 이벤트', { 종류: event.eventType, 내용: event.data });
    onEvent(event);
  });
}

/**
 * 채팅방 하나의 실시간 이벤트를 듣는다.
 *
 * `roomId`가 null이면 구독하지 않는다. 방 정보를 아직 못 받은 화면이 빈 구독을 만들지
 * 않도록 하기 위해서다.
 */
export function useChatRoomEvents(
  roomId: number | null,
  onEvent: (event: ChatRoomEvent) => void,
): void {
  useJsonSubscription(
    roomId === null ? null : chatRoomSubscriptionId(roomId),
    roomId === null ? null : chatRoomTopic(roomId),
    onEvent,
  );
}

/**
 * 구독이 거절될 때 오는 오류를 듣는다.
 *
 * 구독 실패는 조용히 지나가면 "이벤트가 안 온다"로만 보인다. 채팅 영역에서 한 번 걸어 두면
 * 어떤 destination이 왜 막혔는지 알 수 있다.
 */
export function useSubscriptionErrors(onError: (event: SubscriptionFailedEvent) => void): void {
  useJsonSubscription(USER_ERRORS_SUBSCRIPTION_ID, USER_ERRORS_QUEUE, onError);
}

/**
 * JSON 본문을 파싱해 넘기는 구독.
 *
 * 처리 함수는 화면이 렌더될 때마다 새로 만들어지기 쉬우므로 참조를 따로 붙잡는다. 그러지
 * 않으면 렌더마다 구독을 끊고 다시 맺어, 그 틈에 온 이벤트를 놓친다.
 */
function useJsonSubscription<T>(
  id: string | null,
  destination: string | null,
  onEvent: (event: T) => void,
): void {
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    if (id === null || destination === null) return;

    return subscribeDestination(id, destination, (body) => {
      try {
        handlerRef.current(JSON.parse(body) as T);
      } catch {
        // 본문이 깨져 있으면 그 이벤트만 버린다. 구독은 유지한다.
      }
    });
  }, [destination, id]);
}
