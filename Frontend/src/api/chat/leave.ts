import { apiRequest } from '../client';
import { usesMock } from '../config';
import { traceChat } from './log';
import { leaveMockPinChats } from '@/mocks/chat';
import type { PinChatLeaveResult } from '@/types/chat';
import type { PinId } from '@/types/pin';

/**
 * 핀 떠났어요 — `POST /api/v1/chat/pins/{pinId}/rooms/leave`
 *
 * 핀 상세 화면에서 부르지만 채팅 도메인 API다(경로도 `/api/v1/chat/...`).
 * 작성자가 자기 핀에 걸린 모든 채팅방을 한 번에 `LEFT`로 바꾼다.
 * 핀 자체와 크레딧 거래는 그대로 두므로 핀 삭제와 다르다.
 *
 * 이미 전부 `LEFT`여도 성공하며 `leftChatRoomIds`가 빈 배열로 온다.
 * 부분 성공은 없다 — 하나라도 실패하면 서버가 전체를 롤백한다.
 *
 * 오류 코드: `INVALID_PIN_ID` `UNAUTHORIZED` `CHAT_PIN_LEAVE_FORBIDDEN`
 * `PIN_NOT_FOUND` `CHAT_PIN_LEAVE_FAILED`.
 */
function requestLeavePinChats(pinId: PinId): Promise<PinChatLeaveResult> {
  return apiRequest<PinChatLeaveResult>({
    method: 'POST',
    url: `/api/v1/pins/${pinId}/leave`,
  });
}

export function leavePinChats(pinId: PinId): Promise<PinChatLeaveResult> {
  return traceChat(
    '핀 떠났어요',
    'chat/leave',
    () => (usesMock('chat/leave') ? leaveMockPinChats(pinId) : requestLeavePinChats(pinId)),
    (result) => ({ pinId: result.pinId, 종료된방: result.leftChatRoomIds.length }),
  );
}
