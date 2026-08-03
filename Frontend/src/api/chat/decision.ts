import { apiRequest } from '../client';
import { usesMock } from '../config';
import { traceChat } from './log';
import { decideMockChatRequest } from '@/mocks/chat';
import type { ChatDecision, ChatDecisionResult } from '@/types/chat';

/**
 * 채팅 요청 응답 — `POST /api/v1/chat/requests/{roomId}/decision`
 *
 * 요청을 **받은 사람만** 부를 수 있다. `ACCEPT`면 요청자에게서 5크레딧이 빠져 수락자에게
 * 들어가고 방이 열린다. 크레딧 이동과 상태 변경은 한 트랜잭션이라 부분 성공이 없다.
 *
 * `REJECT`와 `LEFT`는 방도 거래도 만들지 않는다. 한 번 처리한 요청은 되돌릴 수 없어,
 * 같은 방에 두 번 응답하면 `CHAT_REQUEST_ALREADY_DECIDED`가 온다.
 *
 * 요청자가 그사이 크레딧을 다 써 5 미만이 되면 수락 시점에 `INSUFFICIENT_CREDIT`이 난다.
 * 수락하는 사람 잘못이 아니므로 화면에서는 그렇게 읽히지 않게 안내해야 한다.
 *
 * 오류 코드: `INVALID_CHAT_DECISION` `UNAUTHORIZED` `CHAT_REQUEST_DECISION_FORBIDDEN`
 * `CHAT_REQUEST_NOT_FOUND` `CHAT_REQUEST_ALREADY_DECIDED` `INSUFFICIENT_CREDIT`
 * `CHAT_REQUEST_DECISION_FAILED`.
 */
function requestDecideChatRequest(roomId: number, decision: ChatDecision): Promise<ChatDecisionResult> {
  return apiRequest<ChatDecisionResult>({
    method: 'POST',
    url: `/api/v1/chat/requests/${roomId}/decision`,
    data: { decision },
  });
}

export function decideChatRequest(roomId: number, decision: ChatDecision): Promise<ChatDecisionResult> {
  return traceChat(
    `채팅 요청 ${decision}`,
    'chat/decision',
    () =>
      usesMock('chat/decision')
        ? decideMockChatRequest(roomId, decision)
        : requestDecideChatRequest(roomId, decision),
    (result) => ({ roomId: result.roomId, 상태: result.status }),
  );
}
