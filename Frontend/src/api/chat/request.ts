import { apiRequest } from '../client';
import { usesMock } from '../config';
import { createMockChatRequest } from '@/mocks/chat';
import type { ChatRequestResult } from '@/types/chat';

/**
 * 익명 채팅 요청 — `POST /api/v1/chat/request/{pinId}`
 *
 * 구매 완료 · 작성자가 아님 · 핀 활성 · 대기 요청이나 활성 방 없음을 모두 만족해야 한다.
 * 상세 조회의 `canRequestChat`이 이 조건을 미리 계산해 준다.
 * 성공하면 `PENDING` 상태의 채팅방이 만들어지고 작성자에게 알림이 간다.
 *
 * 명세에 `pinId`가 Path와 Body 양쪽에 필수로 적혀 있어 둘 다 보낸다.
 *
 * 오류 코드: `INVALID_PIN_ID` `UNAUTHORIZED` `CHAT_REQUEST_FORBIDDEN`
 * `PIN_NOT_FOUND` `CHAT_REQUEST_ALREADY_EXISTS` `CHAT_REQUEST_CREATE_FAILED`.
 */
function requestCreateChatRequest(pinId: number): Promise<ChatRequestResult> {
  return apiRequest<ChatRequestResult>({
    method: 'POST',
    url: `/api/v1/chat/request/${pinId}`,
    data: { pinId },
  });
}

export function createChatRequest(pinId: number): Promise<ChatRequestResult> {
  return usesMock('chat/request') ? createMockChatRequest(pinId) : requestCreateChatRequest(pinId);
}
