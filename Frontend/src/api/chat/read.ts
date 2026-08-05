import { apiRequest } from '../client';
import { usesMock } from '../config';
import { updateMockChatRead } from '@/mocks/chat';
import type { ChatReadResult } from '@/types/chat';
import { traceChat } from './log';

/**
 * 읽음 위치 갱신 — `PATCH /api/v1/chat/rooms/{roomId}/read`
 *
 * 보내는 값은 "받은 메시지 중 가장 큰 id"가 아니라 **화면에 실제로 표시된 것 중 가장 큰 id**다.
 * 목록에서 새 메시지 이벤트만 받은 경우나 다른 방을 보고 있을 때는 부르지 않는다. 사용자가
 * 읽지 않은 것을 읽음으로 만들면 되돌릴 방법이 없다(서버가 뒤로 되돌리지 않는다).
 *
 * 멱등하다. 같은 값이나 더 작은 값을 다시 보내도 오류 없이 저장된 값이 온다. 그래서 화면을
 * 떠날 때마다 부담 없이 부를 수 있다.
 *
 * 오류 코드: `INVALID_ROOM_ID` `INVALID_MESSAGE_ID` `UNAUTHORIZED`
 * `CHAT_ROOM_ACCESS_DENIED` `CHAT_ROOM_NOT_FOUND` `CHAT_MESSAGE_NOT_FOUND`
 * `CHAT_READ_UPDATE_FAILED`.
 */
function requestChatRead(roomId: number, lastReadMessageId: number): Promise<ChatReadResult> {
  return apiRequest<ChatReadResult>({
    method: 'PATCH',
    url: `/api/v1/chat/rooms/${roomId}/read`,
    data: { lastReadMessageId },
  });
}

export function updateChatRead(roomId: number, lastReadMessageId: number): Promise<ChatReadResult> {
  return traceChat(
    '읽음 위치 갱신',
    'chat/read',
    () =>
      usesMock('chat/read')
        ? updateMockChatRead(roomId, lastReadMessageId)
        : requestChatRead(roomId, lastReadMessageId),
    (result) => ({
      roomId: result.roomId,
      보낸값: lastReadMessageId,
      저장된값: result.lastReadMessageId,
    }),
  );
}
