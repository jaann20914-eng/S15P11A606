import { apiRequest } from '../client';
import { usesMock } from '../config';
import { createMockChatRequest } from '@/mocks/chat';
import type { ChatRequestResult } from '@/types/chat';
import type { PinId } from '@/types/pin';

/**
 * 익명 채팅 요청 — `POST /api/v1/chat/request`
 *
 * 구매 완료 · 작성자가 아님 · 핀 활성 · 대기 요청이나 활성 방 없음 · **크레딧 5 이상**을 모두
 * 만족해야 한다. 상세 조회의 `canRequestChat`이 앞의 네 가지를 미리 계산해 주지만 크레딧은
 * 그 안에 없으므로, 잔액이 모자라면 눌러 본 뒤에야 `INSUFFICIENT_CREDIT`으로 알게 된다.
 *
 * 성공하면 `PENDING` 상태의 채팅방이 만들어지고 작성자에게 알림이 간다. 이때 크레딧은 아직
 * 빠지지 않는다 — 상대가 수락하는 순간 옮겨 간다.
 *
 * 핀 식별자는 본문으로만 보낸다. 경로에는 넣지 않는다.
 *
 * 오류 코드: `INVALID_PIN_ID` `UNAUTHORIZED` `CHAT_REQUEST_FORBIDDEN` `PIN_NOT_FOUND`
 * `CHAT_REQUEST_ALREADY_EXISTS` `INSUFFICIENT_CREDIT` `CHAT_REQUEST_CREATE_FAILED`.
 */
function requestCreateChatRequest(pinId: PinId): Promise<ChatRequestResult> {
  return apiRequest<ChatRequestResult>({
    method: 'POST',
    url: '/api/v1/chat/request',
    data: { pinId },
  });
}

export function createChatRequest(pinId: PinId): Promise<ChatRequestResult> {
  return usesMock('chat/request') ? createMockChatRequest(pinId) : requestCreateChatRequest(pinId);
}
