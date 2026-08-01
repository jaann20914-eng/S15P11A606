import { apiRequest } from '../client';
import { usesMock } from '../config';
import { fetchMockPinVideoStatus } from '@/mocks/pin';
import type { PinStatusResult } from '@/types/pinCreate';
import type { PinId } from '@/types/pin';

/**
 * 핀 영상 처리 상태 조회 — `GET /api/v1/pins/{pinId}/status`
 *
 * 등록은 202로 접수만 되고 AI 블러 처리는 비동기로 돈다. 완료를 알 방법이 이것뿐이라
 * 진행 화면이 이 값을 주기적으로 확인한다(2~3초 간격, 화면을 벗어나면 중단).
 *
 * `PENDING`이면 계속 묻고, `ACTIVE`·`REJECTED`·`FAILED` 중 하나가 오면 멈춘다.
 * 영상·썸네일 URL은 `ACTIVE`이고 아직 만료되지 않았을 때만 온다.
 *
 * 자기가 등록한 핀만 조회할 수 있다.
 *
 * 오류 코드: `INVALID_REQUEST` `UNAUTHORIZED` `PIN_STATUS_READ_FORBIDDEN`
 * `PIN_NOT_FOUND` `PIN_STATUS_READ_FAILED`.
 */
function requestPinVideoStatus(pinId: PinId): Promise<PinStatusResult> {
  return apiRequest<PinStatusResult>({ method: 'GET', url: `/api/v1/pins/${pinId}/status` });
}

export async function getPinVideoStatus(pinId: PinId): Promise<PinStatusResult> {
  if (usesMock('pin/status')) return fetchMockPinVideoStatus(pinId);
  return requestPinVideoStatus(pinId);
}
