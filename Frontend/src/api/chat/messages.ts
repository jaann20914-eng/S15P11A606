import { apiRequest } from '../client';
import { usesMock } from '../config';
import { fetchMockChatHistory } from '@/mocks/chat';
import type { ChatRoomHistory } from '@/types/chat';
import { traceChat } from './log';

/**
 * 채팅 메시지·안전 경고 이력 — `GET /api/v1/chat/rooms/{roomId}/messages`
 *
 * 방 하나를 그리는 데 필요한 것을 한 번에 준다 — 상태·장소·상대 정보와 메시지, 그리고 지금까지
 * 쌓인 안전 경고다. 그래서 목록을 거치지 않고 바로 들어와도 헤더가 비지 않는다.
 *
 * 페이지네이션이 없다. 방 하나의 대화는 짧게 끝나는 것을 전제로 한 명세다. 길어지면 서버가
 * 커서를 붙일 텐데, 그때는 위쪽으로 더 불러오는 처리를 여기에 더한다.
 *
 * `REFUSED`·`LEFT`인 방도 지난 대화는 볼 수 있다. 보낼 수만 없다.
 *
 * 오류 코드: `INVALID_ROOM_ID` `UNAUTHORIZED` `CHAT_ROOM_ACCESS_DENIED`
 * `CHAT_ROOM_NOT_FOUND` `CHAT_MESSAGES_FETCH_FAILED`.
 */
function requestChatHistory(roomId: number): Promise<ChatRoomHistory> {
  return apiRequest<ChatRoomHistory>({
    method: 'GET',
    url: `/api/v1/chat/rooms/${roomId}/messages`,
  });
}

export function getChatHistory(roomId: number): Promise<ChatRoomHistory> {
  return traceChat(
    '채팅 이력',
    'chat/messages',
    () => (usesMock('chat/messages') ? fetchMockChatHistory(roomId) : requestChatHistory(roomId)),
    (history) => ({
      roomId,
      상태: history.status,
      메시지: history.messages.length,
      경고: history.warnings.length,
      마지막메시지: history.messages.at(-1)?.messageId ?? '없음',
    }),
  );
}
