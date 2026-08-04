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
 * 글의 안 읽음 점을 방 목록으로 다시 계산한다.
 *
 * 서버의 글 단위 `hasUnread`는 두 가지가 어긋난다:
 *
 * - **안 읽은 상대 메시지**만 센다 — 채팅 요청은 방(`PENDING`)만 만들고 메시지는 만들지
 *   않아서, 요청이 와도 켜지지 않는다. 정작 가장 먼저 봐야 하는 글에 표시가 없었다.
 * - 방 상태를 보지 않는다 — 거절하거나 떠난 방에 남은 메시지를 계속 세서, **거절해도 점이
 *   꺼지지 않았다**(2026-08-05).
 *
 * 그래서 서버 값 대신 글마다 방 목록을 받아 "응답 대기 중인 요청이 있거나, 열려 있는 방에
 * 안 읽은 메시지가 있으면" 켠다(방 목록 쪽에서 이미 종료된 방의 안 읽음을 지워 준다).
 * 조회가 실패한 글은 서버 값을 그대로 둔다 — 점 하나 때문에 목록이 실패하면 안 된다.
 *
 * 서버 집계가 요청을 세고 종료된 방을 빼기 시작하면 이 함수를 지운다.
 */
function resolveUnreadDots(pins: ChatPinListItem[]): Promise<ChatPinListItem[]> {
  return Promise.all(
    pins.map(async (pin) => {
      try {
        const rooms = await getPinChatRooms(pin.pinId);

        return {
          ...pin,
          hasUnread: rooms.some((room) => room.status === 'PENDING' || room.hasUnread),
          // 전부 끝난 글은 줄을 연하게 누른다. 점과 같은 재료(방 목록)로 함께 계산한다.
          closed: rooms.length > 0 && rooms.every((room) => room.status === 'CLOSED'),
        };
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
    async () => resolveUnreadDots(await fetchAllPages(loadChatPins)),
    (pins) => ({
      건수: pins.length,
      표시: pins.filter((pin) => pin.hasUnread).length,
      장소: pins.map((pin) => pin.placeName).join(', ') || '없음',
    }),
  );
}
