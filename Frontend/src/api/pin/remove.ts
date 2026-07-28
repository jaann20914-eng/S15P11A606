import { apiRequest } from '../client';
import { usesMockApi } from '../config';
import { deleteMockPin } from '@/mocks/pin';
import type { PinDeleteResult } from '@/types/pin';

/**
 * 핀 삭제 — `DELETE /api/v1/pins/{pinId}`
 *
 * 물리 삭제가 아니라 `DELETED` 상태 전환이다. 대기 중 채팅 요청은 종료되고
 * 활성 채팅방은 `CLOSED`로 바뀐다(응답의 `closedChatRoomIds`).
 * 같은 작성자의 재요청은 같은 결과를 돌려주므로 재시도해도 안전하다.
 *
 * 오류 코드: `INVALID_PIN_ID` `UNAUTHORIZED` `PIN_DELETE_FORBIDDEN`
 * `PIN_NOT_FOUND` `PIN_DELETE_NOT_ALLOWED` `PIN_DELETE_FAILED`.
 */
function requestDeletePin(pinId: number): Promise<PinDeleteResult> {
  return apiRequest<PinDeleteResult>({ method: 'DELETE', url: `/api/v1/pins/${pinId}` });
}

export function deletePin(pinId: number): Promise<PinDeleteResult> {
  return usesMockApi ? deleteMockPin(pinId) : requestDeletePin(pinId);
}
