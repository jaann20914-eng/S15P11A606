import { apiRequest } from '../client';
import { usesMock } from '../config';
import { listMockChatPins } from '@/mocks/chat';
import type { ChatDirection, ChatPinListItem, CursorPage, CursorQuery } from '@/types/chat';

/**
 * 채팅이 걸린 게시글 목록 — `GET /api/v1/chat/pins`
 *
 * 받은 요청 탭에서 먼저 보는 화면이다. 요청이 방마다 흩어져 있으면 어느 게시글 이야기인지
 * 알기 어려워, 게시글을 먼저 고르고 그 안의 방 목록으로 들어간다.
 *
 * 같은 핀에 요청이 여러 개 와도 핀은 한 번만 온다. 핀 등록 시각 내림차순이다.
 *
 * 오류 코드: `INVALID_CHAT_PIN_DIRECTION` `INVALID_PAGINATION` `UNAUTHORIZED`
 * `CHAT_PINS_FETCH_FAILED`.
 */
function requestChatPins(
  direction: ChatDirection,
  query: CursorQuery,
): Promise<CursorPage<ChatPinListItem>> {
  return apiRequest<CursorPage<ChatPinListItem>>({
    method: 'GET',
    url: '/api/v1/chat/pins',
    params: { direction, ...query },
  });
}

export function getChatPins(
  direction: ChatDirection = 'received',
  query: CursorQuery = {},
): Promise<CursorPage<ChatPinListItem>> {
  return usesMock('chat/pins') ? listMockChatPins(direction, query) : requestChatPins(direction, query);
}
