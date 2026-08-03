import { apiRequest } from '../client';
import { usesMock } from '../config';
import { listMockChatPins } from '@/mocks/chat';
import type { ChatPinListItem, CursorPage, CursorQuery } from '@/types/chat';
import { fetchAllPages } from './paging';

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

/** 채팅이 걸린 게시글 전체. 무한 스크롤을 두지 않기로 해서 커서를 끝까지 따라간다. */
export function getChatPins(): Promise<ChatPinListItem[]> {
  return fetchAllPages(loadChatPins);
}
