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

export function createPin(body: PinCreateRequest): Promise<PinCreateResult> {
  /*
    등록한 핀을 목업 표에 넣어 주던 처리를 걷어냈다. 상세 조회가 목업이던 동안에는 등록 직후
    상세로 넘어가면 "찾을 수 없어요"가 떴는데, 지금은 상세도 실서버라 그럴 일이 없다.
    목업 모드에서는 등록도 목업이므로 짝이 맞는다.
  */
  return usesMock('pin/create') ? createMockPin(body) : requestPinCreate(body);
}
