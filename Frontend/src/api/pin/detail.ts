import { apiRequest } from '../client';
import { usesMock } from '../config';
import { fetchMockPinDetail } from '@/mocks/pin';
import { toCrowdLevelKey } from '@/types/pin';
import type { PinDetail, PinDetailResponse } from '@/types/pin';

/**
 * 게시글 상세 조회 — `GET /api/v1/pins/{pinId}`
 *
 * 오류 코드: `INVALID_PIN_ID` `UNAUTHORIZED` `PIN_NOT_FOUND`
 * `PIN_DETAIL_FETCH_FAILED` `VIDEO_URL_ISSUE_FAILED`.
 */
function requestPinDetail(pinId: number): Promise<PinDetailResponse> {
  return apiRequest<PinDetailResponse>({ method: 'GET', url: `/api/v1/pins/${pinId}` });
}

/** 서버 응답을 화면이 쓰는 모양으로 바꾼다. 지금은 혼잡 단계 enum 하나만 다르다. */
function toPinDetail(response: PinDetailResponse): PinDetail {
  return { ...response, crowdLevel: toCrowdLevelKey(response.crowdLevel) };
}

export async function getPinDetail(pinId: number): Promise<PinDetail> {
  const response = usesMock('pin/detail') ? await fetchMockPinDetail(pinId) : await requestPinDetail(pinId);
  return toPinDetail(response);
}
