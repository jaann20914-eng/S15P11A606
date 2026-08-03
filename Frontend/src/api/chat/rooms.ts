import { apiRequest } from '../client';
import { usesMock } from '../config';
import { listMockChatRooms, listMockPinChatRooms } from '@/mocks/chat';
import type { ChatDirection, ChatRoomListItem, CursorPage, CursorQuery } from '@/types/chat';
import type { PinId } from '@/types/pin';

/**
 * 내 채팅방 목록 — `GET /api/v1/chat/rooms`
 *
 * `direction`으로 방향을 가른다. `sent`는 내가 요청한 대화(보낸 요청 탭), `received`는 내가
 * 요청받은 대화다. 최근 메시지 시각 내림차순으로 온다.
 *
 * `PENDING`이어도 방은 이미 있고 `roomId`가 온다 — 수락 전에도 요청자는 메시지를 보낼 수 있다.
 * 종료된 방(`REFUSED`·`LEFT`)도 목록에 남아 이력만 볼 수 있다.
 *
 * 오류 코드: `INVALID_CHAT_ROOM_DIRECTION` `INVALID_PAGINATION` `UNAUTHORIZED`
 * `CHAT_ROOMS_FETCH_FAILED`.
 */
function requestChatRooms(
  direction: ChatDirection,
  query: CursorQuery,
): Promise<CursorPage<ChatRoomListItem>> {
  return apiRequest<CursorPage<ChatRoomListItem>>({
    method: 'GET',
    url: '/api/v1/chat/rooms',
    params: { direction, ...query },
  });
}

export function getChatRooms(
  direction: ChatDirection,
  query: CursorQuery = {},
): Promise<CursorPage<ChatRoomListItem>> {
  return usesMock('chat/rooms')
    ? listMockChatRooms(direction, query)
    : requestChatRooms(direction, query);
}

/**
 * 특정 핀의 채팅방 목록 — `GET /api/v1/chat/rooms/{pinId}`
 *
 * 받은 요청에서 게시글을 고른 뒤 보는 목록이다. 한 핀에 여러 사람이 요청할 수 있어 방이 여럿이다.
 *
 * 방향을 함께 보낸다. 내 핀이라도 내가 요청한 대화와 받은 대화가 섞이지 않도록 서버가 가른다.
 *
 * 오류 코드: 내 채팅방 목록과 같다.
 */
function requestPinChatRooms(
  pinId: PinId,
  direction: ChatDirection,
  query: CursorQuery,
): Promise<CursorPage<ChatRoomListItem>> {
  return apiRequest<CursorPage<ChatRoomListItem>>({
    method: 'GET',
    url: `/api/v1/chat/rooms/${pinId}`,
    params: { direction, ...query },
  });
}

export function getPinChatRooms(
  pinId: PinId,
  direction: ChatDirection = 'received',
  query: CursorQuery = {},
): Promise<CursorPage<ChatRoomListItem>> {
  return usesMock('chat/rooms')
    ? listMockPinChatRooms(pinId, direction, query)
    : requestPinChatRooms(pinId, direction, query);
}
