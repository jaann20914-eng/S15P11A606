import { apiRequest } from '../client';
import { usesMock } from '../config';
import { listMockChatRooms, listMockPinChatRooms } from '@/mocks/chat';
import type { ChatRoomListItem, CursorPage, CursorQuery } from '@/types/chat';
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

function toRoomPage(page: CursorPage<RawChatRoomListItem>): CursorPage<ChatRoomListItem> {
  return { items: page.items.map(toRoomItem), nextCursor: page.nextCursor };
}

/**
 * 내가 요청한 채팅방 목록 — `GET /api/v1/chat/rooms`
 *
 * "요청한 대화" 탭이 그대로 이 목록이다. 내가 남의 게시글에 요청해 만들어진 방들이다.
 *
 * `PENDING`이어도 방은 이미 있고 `roomId`가 온다 — 수락 전에도 요청자는 메시지를 보낼 수 있다.
 * 거절되거나 끝난 방(`REFUSED`·`LEFT`)도 목록에 남아 이력만 볼 수 있다.
 * 최근 메시지 시각 내림차순으로 온다.
 *
 * 오류 코드: `INVALID_PAGINATION` `UNAUTHORIZED` `CHAT_ROOMS_FETCH_FAILED`.
 */
async function requestChatRooms(query: CursorQuery): Promise<CursorPage<ChatRoomListItem>> {
  const page = await apiRequest<CursorPage<RawChatRoomListItem>>({
    method: 'GET',
    url: '/api/v1/chat/rooms',
    params: query,
  });

  return toRoomPage(page);
}

function loadChatRooms(query: CursorQuery) {
  return usesMock('chat/rooms') ? listMockChatRooms(query) : requestChatRooms(query);
}

/** 내가 요청한 채팅방 전체. 무한 스크롤을 두지 않기로 해서 커서를 끝까지 따라간다. */
export function getChatRooms(): Promise<ChatRoomListItem[]> {
  return fetchAllPages(loadChatRooms);
}

/**
 * 내 게시글에 온 채팅방 목록 — `GET /api/v1/chat/rooms/{pinId}`
 *
 * 요청받은 대화 탭에서 게시글을 고른 뒤 보는 목록이다. 한 글에 여러 사람이 요청할 수 있어
 * 방이 여럿이다. 여기서 수락·거절을 한다.
 *
 * 오류 코드: 위와 같다.
 */
async function requestPinChatRooms(
  pinId: PinId,
  query: CursorQuery,
): Promise<CursorPage<ChatRoomListItem>> {
  const page = await apiRequest<CursorPage<RawChatRoomListItem>>({
    method: 'GET',
    url: `/api/v1/chat/rooms/${pinId}`,
    params: query,
  });

  return toRoomPage(page);
}

function loadPinChatRooms(pinId: PinId, query: CursorQuery) {
  return usesMock('chat/rooms')
    ? listMockPinChatRooms(pinId, query)
    : requestPinChatRooms(pinId, query);
}

/** 이 게시글에 달린 채팅방 전체. */
export function getPinChatRooms(pinId: PinId): Promise<ChatRoomListItem[]> {
  return fetchAllPages((query) => loadPinChatRooms(pinId, query));
}
