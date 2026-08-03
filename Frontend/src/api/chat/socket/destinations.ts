/**
 * 구독·발행 주소를 한곳에서 만든다.
 *
 * 문자열을 화면에 흩어 두면 서버가 경로를 바꿀 때 어디를 고쳐야 하는지 알 수 없고,
 * 오타는 조용한 "이벤트가 안 와요"로 나타난다.
 */

/** 채팅방 실시간 이벤트. 참여자만 구독할 수 있다. */
export function chatRoomTopic(roomId: number): string {
  return `/topic/chat/rooms/${roomId}`;
}

/**
 * 구독 식별자. 한 세션 안에서 겹치면 안 된다.
 *
 * 방 하나당 하나로 정해 두면 같은 방을 두 번 구독하는 실수가 드러난다.
 */
export function chatRoomSubscriptionId(roomId: number): string {
  return `chat-room-${roomId}`;
}

/** 사용자 전용 채팅방 목록 이벤트. 사용자 ID는 서버가 세션에서 정한다. */
export const USER_CHAT_ROOMS_QUEUE = '/user/queue/chat-rooms';
export const USER_CHAT_ROOMS_SUBSCRIPTION_ID = 'user-chat-rooms';

/** 구독 거절 등 발신자 전용 오류. */
export const USER_ERRORS_QUEUE = '/user/queue/errors';
export const USER_ERRORS_SUBSCRIPTION_ID = 'user-errors';

/** 메시지 발행 주소. `/topic`으로 직접 보내는 것은 서버가 막는다. */
export function chatRoomSendDestination(roomId: number): string {
  return `/app/chat/rooms/${roomId}/messages`;
}
