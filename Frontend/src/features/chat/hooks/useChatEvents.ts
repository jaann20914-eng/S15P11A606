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
 * 사용자 전용 이벤트를 기다리는 화면들.
 *
 * 같은 큐를 세 목록(요청한 대화·게시글·게시글의 방)이 함께 듣는다. 각자 구독하게 두면
 * `subscribeDestination`이 같은 id의 앞 신청을 버려 **마지막 하나만 이벤트를 받았다** —
 * 방 줄은 갱신되는데 게시글 줄은 조용하던 원인(2026-08-05). 서버 구독은 여기 하나만 두고
 * 도착한 이벤트를 안에서 나눠 준다.
 */
const userEventListeners = new Set<(event: UserChatEvent) => void>();

/** 살아 있는 서버 구독을 끊는 함수. 아무도 듣지 않으면 null이다. */
let stopUserQueue: (() => void) | null = null;

/**
 * 사용자 전용 채팅방 목록 이벤트를 듣는다.
 *
 * 방에 매이지 않으므로 채팅 영역에 있는 동안 계속 열어 둔다. 목록 화면이 이 이벤트로
 * 마지막 메시지·안 읽음·상태를 갱신한다.
 */
export function useUserChatEvents(onEvent: (event: UserChatEvent) => void): void {
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    const listener = (event: UserChatEvent) => handlerRef.current(event);

    userEventListeners.add(listener);

    // 첫 화면이 들어올 때만 서버에 신청한다. 구독은 하나면 되고, 나누는 것은 위 목록이 한다.
    stopUserQueue ??= subscribeDestination(USER_CHAT_ROOMS_SUBSCRIPTION_ID, USER_CHAT_ROOMS_QUEUE, (body) => {
      let event: UserChatEvent;

      try {
        event = JSON.parse(body) as UserChatEvent;
      } catch {
        // 본문이 깨져 있으면 그 이벤트만 버린다. 구독은 유지한다.
        return;
      }

      /*
        도착한 것을 남긴다. 이 로그가 없으면 "이벤트가 오지 않았다"와 "왔는데 목록에 반영되지
        않았다"를 가릴 수 없다 — 둘 다 화면에서는 아무 일도 일어나지 않은 것으로 보인다.
      */
      log('목록 이벤트', { 종류: event.eventType, 듣는화면: userEventListeners.size });
      userEventListeners.forEach((deliver) => deliver(event));
    });

    return () => {
      userEventListeners.delete(listener);

      if (userEventListeners.size === 0) {
        stopUserQueue?.();
        stopUserQueue = null;
      }
    };
  }, []);
}

/**
 * 채팅방 하나의 실시간 이벤트를 듣는다.
 *
 * `roomId`가 null이면 구독하지 않는다. 방 정보를 아직 못 받은 화면이 빈 구독을 만들지
 * 않도록 하기 위해서다.
 */
export function useChatRoomEvents(roomId: number | null, onEvent: (event: ChatRoomEvent) => void): void {
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
 * 훅 사용처마다 다른 구독 id를 만들기 위한 일련번호.
 *
 * `subscribeDestination`은 같은 id로 다시 신청하면 **앞의 것을 버린다**(안 그러면 서버에
 * 구독이 겹겹이 남는다). 같은 자리를 두 화면이 들으면 마지막 하나만 살아남아, 앞의 화면은
 * 이벤트가 안 오는 것처럼 보인다 — 목록 훅 셋이 실제로 그랬다(2026-08-05, 그쪽은 위의
 * 나눔 구조로 옮겼다). 남은 사용처(방 이벤트·구독 오류)도 같은 함정을 밟지 않게 번호로 가른다.
 */
let nextListenerNumber = 0;

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

    // 같은 자리(destination)를 함께 듣는 다른 화면의 구독을 밀어내지 않도록 id를 가른다.
    return subscribeDestination(`${id}-${nextListenerNumber++}`, destination, (body) => {
      try {
        handlerRef.current(JSON.parse(body) as T);
      } catch {
        // 본문이 깨져 있으면 그 이벤트만 버린다. 구독은 유지한다.
      }
    });
  }, [destination, id]);
}
