import { apiRequest } from '../client';
import { usesMock } from '../config';
import { listMockChatRooms, listMockPinChatRooms } from '@/mocks/chat';
import type { ChatDirection, ChatRoomListItem, CursorPage, CursorQuery } from '@/types/chat';
import type { PinId } from '@/types/pin';
import { fetchAllPages } from './paging';

/**
 * 서버가 주는 목록 한 줄.
 *
 * 안 읽음 표시의 이름이 명세 안에서 갈린다 — 필드 표에는 `isRead`, 예시 JSON과 다른 명세에는
 * `hasUnread`로 적혀 있다. 엔드포인트가 아직 열리지 않아 실제 응답으로 확인할 수 없으므로
 * 둘 다 받아 두고, 화면에는 하나로 정리해 넘긴다(`toRoomItem`).
 */
type RawChatRoomListItem = Omit<ChatRoomListItem, 'hasUnread'> & {
  hasUnread?: boolean;
  isRead?: boolean;
};

/**
 * 안 읽음 여부를 하나로 정리한다.
 *
 * 둘 다 없으면 "읽었다"로 본다. 없는 값을 안 읽음으로 두면 목록 전체에 배지가 붙어, 진짜 안 읽은
 * 방을 찾을 수 없게 된다.
 */
function toRoomItem(raw: RawChatRoomListItem): ChatRoomListItem {
  const { hasUnread, isRead, ...rest } = raw;

  return { ...rest, hasUnread: hasUnread ?? (isRead === undefined ? false : !isRead) };
}

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
async function requestChatRooms(
  direction: ChatDirection,
  query: CursorQuery,
): Promise<CursorPage<ChatRoomListItem>> {
  const page = await apiRequest<CursorPage<RawChatRoomListItem>>({
    method: 'GET',
    url: '/api/v1/chat/rooms',
    params: { direction, ...query },
  });

  return { items: page.items.map(toRoomItem), nextCursor: page.nextCursor };
}

function loadChatRooms(direction: ChatDirection, query: CursorQuery) {
  return usesMock('chat/rooms')
    ? listMockChatRooms(direction, query)
    : requestChatRooms(direction, query);
}

/** 내 채팅방 전체. 무한 스크롤을 두지 않기로 해서 커서를 끝까지 따라간다. */
export function getChatRooms(direction: ChatDirection): Promise<ChatRoomListItem[]> {
  return fetchAllPages((query) => loadChatRooms(direction, query));
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
async function requestPinChatRooms(
  pinId: PinId,
  direction: ChatDirection,
  query: CursorQuery,
): Promise<CursorPage<ChatRoomListItem>> {
  const page = await apiRequest<CursorPage<RawChatRoomListItem>>({
    method: 'GET',
    url: `/api/v1/chat/rooms/${pinId}`,
    params: { direction, ...query },
  });

  return { items: page.items.map(toRoomItem), nextCursor: page.nextCursor };
}

function loadPinChatRooms(pinId: PinId, direction: ChatDirection, query: CursorQuery) {
  return usesMock('chat/rooms')
    ? listMockPinChatRooms(pinId, direction, query)
    : requestPinChatRooms(pinId, direction, query);
}

/** 이 핀에 달린 채팅방 전체. 기본값은 받은 요청 쪽이다. */
export function getPinChatRooms(
  pinId: PinId,
  direction: ChatDirection = 'received',
): Promise<ChatRoomListItem[]> {
  return fetchAllPages((query) => loadPinChatRooms(pinId, direction, query));
}
