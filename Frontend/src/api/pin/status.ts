import { apiRequest } from '../client';
import { usesMockApi } from '../config';
import { fetchMockPinVideoStatus } from '@/mocks/pin';
import type { PinStatusResult } from '@/types/pinCreate';

/**
 * 핀 영상 처리 상태 조회.
 *
 * 등록은 202로 접수만 되고 AI 블러 처리는 비동기로 돈다. 완료를 알 방법이 이것뿐이라
 * 진행 화면이 이 값을 주기적으로 확인한다.
 *
 * 이 파일이 상태 조회 계약을 담는 유일한 곳이다. 명세가 확정되면 여기만 고치면 되고
 * 폴링 로직은 그대로 쓴다.
 *
 * 아직 확정되지 않아 가정한 것:
 * - 경로 `GET /api/v1/pins/{pinId}/status`
 * - 응답 `{ pinId, videoStatus }`
 *
 * 오류 코드: `UNAUTHORIZED` `PIN_NOT_FOUND`(추정).
 */
function requestPinVideoStatus(pinId: number): Promise<PinStatusResult> {
  return apiRequest<PinStatusResult>({ method: 'GET', url: `/api/v1/pins/${pinId}/status` });
}

export async function getPinVideoStatus(pinId: number): Promise<PinStatusResult> {
  if (usesMockApi) return fetchMockPinVideoStatus(pinId);
  return requestPinVideoStatus(pinId);
}
