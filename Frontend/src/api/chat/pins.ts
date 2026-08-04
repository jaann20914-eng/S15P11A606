import { apiRequest } from '../client';
import { usesMock } from '../config';
import { listMockChatPins } from '@/mocks/chat';
import type { ChatPinListItem, CursorPage, CursorQuery } from '@/types/chat';
import { traceChat } from './log';
import { fetchAllPages } from './paging';
import { getPinChatRooms } from './rooms';

/**
 * 채팅이 걸린 내 게시글 목록 — `GET /api/v1/chat/pins`
 *
 * 요청받은 대화 탭의 첫 화면이다. 요청이 방마다 흩어져 있으면 어느 게시글 이야기인지 알기
 * 어려워서, 내가 쓴 글 중 요청이 온 것만 먼저 보여주고 고르면 그 글의 방 목록으로 들어간다.
 *
 * 같은 핀에 요청이 여러 개 와도 핀은 한 번만 온다. 핀 등록 시각 내림차순이다.
 *
 * 오류 코드: `INVALID_PAGINATION` `UNAUTHORIZED` `CHAT_PINS_FETCH_FAILED`.
 */
function requestChatPins(query: CursorQuery): Promise<CursorPage<ChatPinListItem>> {
  return apiRequest<CursorPage<ChatPinListItem>>({
    method: 'GET',
    url: '/api/v1/chat/pins',
    params: query,
  });
}

function loadChatPins(query: CursorQuery) {
  return usesMock('chat/pins') ? listMockChatPins(query) : requestChatPins(query);
}

/**
 * 아직 응답하지 않은 요청이 있는 글에도 점을 켠다.
 *
 * 서버의 `hasUnread`는 **안 읽은 상대 메시지**만 센다 — 집계 쿼리가 `chat_messages`를 조인한다.
 * 그런데 채팅 요청은 방(`PENDING`)만 만들고 메시지는 만들지 않아서, 요청이 도착해도 이 값이
 * false다. 정작 가장 먼저 봐야 하는 글에 아무 표시가 없었다(2026-08-05). 요청 시점에는 실시간
 * 이벤트도 오지 않아 다른 데서 알 방법이 없다.
 *
 * 그래서 방 목록을 보고 `PENDING`이 하나라도 있으면 켠다. 이미 켜진 글은 다시 묻지 않고,
 * 조회가 실패한 글은 서버 값을 그대로 둔다 — 점을 켜려다 목록 자체가 실패하면 안 된다.
 *
 * 서버가 요청까지 세어 주기 시작하면 이 함수를 지운다.
 */
function markPendingRequests(pins: ChatPinListItem[]): Promise<ChatPinListItem[]> {
  return Promise.all(
    pins.map(async (pin) => {
      if (pin.hasUnread) return pin;

      try {
        const rooms = await getPinChatRooms(pin.pinId);

        return rooms.some((room) => room.status === 'PENDING') ? { ...pin, hasUnread: true } : pin;
      } catch {
        return pin;
      }
    }),
  );
}

/** 채팅이 걸린 게시글 전체. 무한 스크롤을 두지 않기로 해서 커서를 끝까지 따라간다. */
export function getChatPins(): Promise<ChatPinListItem[]> {
  return traceChat(
    '채팅 게시글 목록',
    'chat/pins',
    async () => markPendingRequests(await fetchAllPages(loadChatPins)),
    (pins) => ({
      건수: pins.length,
      표시: pins.filter((pin) => pin.hasUnread).length,
      장소: pins.map((pin) => pin.placeName).join(', ') || '없음',
    }),
  );
}
