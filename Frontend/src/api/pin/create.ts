import { apiRequest } from '../client';
import { usesMockApi } from '../config';
import { createMockPin } from '@/mocks/pin';
import type { PinCreateRequest, PinCreateResult } from '@/types/pinCreate';

/**
 * 핀 등록 요청 — `POST /api/v1/pins`
 *
 * 영상 자체를 보내지 않는다. 프론트가 외부 스토리지에 업로드한 뒤 받은 URL과
 * 메타데이터만 보낸다.
 *
 * 성공은 `202`이고 `status`는 `PROCESSING`이다. AI 검수를 통과하면 서버가
 * `ACTIVE`로 바꾼다. 즉 이 응답만으로는 공개 여부를 알 수 없다.
 *
 * 오류 코드: `INVALID_REQUEST` `INVALID_CROWD_LEVEL` `UNAUTHORIZED`
 * `PLACE_NOT_FOUND` `LOCATION_OUT_OF_RANGE` `VIDEO_NOT_ACCESSIBLE`
 * `PIN_CREATE_FAILED` `AI_REQUEST_FAILED`.
 */
function requestPinCreate(body: PinCreateRequest): Promise<PinCreateResult> {
  return apiRequest<PinCreateResult>({ method: 'POST', url: '/api/v1/pins', data: body });
}

export async function createPin(body: PinCreateRequest): Promise<PinCreateResult> {
  if (usesMockApi) return createMockPin(body);
  return requestPinCreate(body);
}
