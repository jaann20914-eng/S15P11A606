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
 * 장소는 `kakaoPlaceId`로 찾고, 없으면 서버가 카카오에서 확인해 만든다. 함께 보내는
 * 장소명·좌표는 그때 참고하는 값일 뿐 최종값으로 쓰이지 않는다. 거리 검증(50m)도 서버가
 * 확인한 장소 좌표로 한다.
 *
 * 오류 코드: `INVALID_REQUEST` `INVALID_CROWD_LEVEL` `UNAUTHORIZED`
 * `VIDEO_ALREADY_REGISTERED` `LOCATION_OUT_OF_RANGE` `VIDEO_NOT_ACCESSIBLE`
 * `DAILY_PIN_LIMIT_EXCEEDED` `PIN_CREATE_FAILED`.
 */
function requestPinCreate(body: PinCreateRequest): Promise<PinCreateResult> {
  return apiRequest<PinCreateResult>({ method: 'POST', url: '/api/v1/pins', data: body });
}

/**
 * 등록과 상세 조회가 **같은 쪽을 보게 되었다.**
 *
 * 예전에는 등록만 실서버로 가고 상세는 목업이라, 방금 만든 핀으로 넘어가면 목업 표에 없는
 * 식별자여서 "영상핀을 찾을 수 없어요"가 떴다. 그래서 결과 id를 목업 표에 끼워 넣는 보정이
 * 있었다. 지금은 `pin/detail`도 실서버라 그 보정이 필요 없다 — 목업 모드에서는 등록도 목업이다.
 */
export async function createPin(body: PinCreateRequest): Promise<PinCreateResult> {
  if (usesMock('pin/create')) return createMockPin(body);
  return requestPinCreate(body);
}
