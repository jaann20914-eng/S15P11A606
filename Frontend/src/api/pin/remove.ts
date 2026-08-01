import { apiRequest } from '../client';
import { usesMock } from '../config';
import { deleteMockPin } from '@/mocks/pin';
import type { PinId, PinDeleteResult } from '@/types/pin';

/**
 * 핀 삭제 — `DELETE /api/v1/pins/{pinId}`
 *
 * 물리 삭제가 아니다. 서버가 삭제 시각만 기록하고, 그 뒤로 홈·장소 상세·핀 상세·검색·추천·
 * 통계에서 즉시 빠진다. 응답의 `status: 'DELETED'`는 처리 결과를 알리는 값이지 영상 상태
 * (`videoStatus`)가 바뀐 것이 아니다.
 *
 * **어느 상태든 지울 수 있다.** 처리 중(`PENDING`)이든 검수 탈락(`REJECTED`)이든 상관없다.
 * 그래서 "지금은 삭제할 수 없다"는 오류가 없다.
 *
 * 대기 중 채팅 요청은 종료되고 활성 채팅방은 `CLOSED`로 바뀐다(응답의 `closedChatRoomIds`).
 * 그 방들은 지난 대화를 읽을 수만 있고 새 메시지는 막힌다.
 *
 * 같은 작성자가 다시 요청해도 200이고, `deletedAt`은 **처음 삭제한 시각** 그대로다.
 * 재시도해도 안전하다.
 *
 * 오류 코드: `INVALID_PIN_ID` `UNAUTHORIZED` `PIN_DELETE_FORBIDDEN`
 * `PIN_NOT_FOUND` `PIN_DELETE_FAILED`.
 */
function requestDeletePin(pinId: PinId): Promise<PinDeleteResult> {
  return apiRequest<PinDeleteResult>({ method: 'DELETE', url: `/api/v1/pins/${pinId}` });
}

export function deletePin(pinId: PinId): Promise<PinDeleteResult> {
  return usesMock('pin/remove') ? deleteMockPin(pinId) : requestDeletePin(pinId);
}
