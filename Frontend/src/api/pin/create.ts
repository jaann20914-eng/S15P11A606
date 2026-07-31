import { apiRequest } from '../client';
import { usesMock } from '../config';
import { createMockPin } from '@/mocks/pin';
import type { PinCreateRequest, PinCreateResult } from '@/types/pinCreate';

/**
 * 핀 등록 요청 — `POST /api/v1/pins`
 *
 * 영상도 영상 URL도 보내지 않는다. Presigned URL로 외부 스토리지에 업로드한 뒤 받은
 * 객체 키(`originalVideoKey`)와 메타데이터만 보낸다.
 *
 * 성공은 `202`이고 `videoStatus`는 `PENDING`이다. AI 검수 결과에 따라 서버가
 * `ACTIVE`·`REJECTED`·`FAILED`로 바꾼다. 이 응답만으로는 공개 여부를 알 수 없고
 * 블러 영상 URL도 주지 않는다.
 *
 * 오류 코드: `INVALID_REQUEST` `INVALID_CROWD_LEVEL` `UNAUTHORIZED`
 * `PLACE_NOT_FOUND` `VIDEO_ALREADY_REGISTERED` `LOCATION_OUT_OF_RANGE`
 * `VIDEO_NOT_ACCESSIBLE` `DAILY_PIN_LIMIT_EXCEEDED` `PIN_CREATE_FAILED`.
 */
function requestPinCreate(body: PinCreateRequest): Promise<PinCreateResult> {
  return apiRequest<PinCreateResult>({ method: 'POST', url: '/api/v1/pins', data: body });
}

export async function createPin(body: PinCreateRequest): Promise<PinCreateResult> {
  if (usesMock('pin/create')) return createMockPin(body);
  return requestPinCreate(body);
}
