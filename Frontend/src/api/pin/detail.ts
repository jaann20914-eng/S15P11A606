import { apiRequest } from '../client';
import { usesMock } from '../config';
import { fetchMockPinDetail } from '@/mocks/pin';
import { toCrowdLevelKey } from '@/types/pin';
import { tracePin } from './log';
import type { PinId, PinDetail, PinDetailResponse } from '@/types/pin';

/**
 * 게시글 상세 조회 — `GET /api/v1/pins/{pinId}`
 *
 * 오류 코드: `INVALID_PIN_ID` `UNAUTHORIZED` `PIN_NOT_FOUND`
 * `PIN_DETAIL_FETCH_FAILED` `VIDEO_URL_ISSUE_FAILED`.
 */
function requestPinDetail(pinId: PinId): Promise<PinDetailResponse> {
  return apiRequest<PinDetailResponse>({ method: 'GET', url: `/api/v1/pins/${pinId}` });
}

/**
 * 서버 응답을 화면이 쓰는 모양으로 바꾼다.
 *
 * 두 가지가 다르다.
 * - 혼잡 단계가 서버 enum에서 프론트 공용 토큰으로 바뀐다
 * - 영상이 하나뿐이라 열람 전·후 자리에 같은 URL을 넣는다. 가리는 일은 화면이 한다
 *   (`types/pin.ts`의 `PinDetailResponse` 설명 참고)
 */
function toPinDetail(response: PinDetailResponse): PinDetail {
  return {
    ...response,
    crowdLevel: toCrowdLevelKey(response.crowdLevel),
    previewUrl: response.videoUrl,
  };
}

export function getPinDetail(pinId: PinId): Promise<PinDetail> {
  return tracePin(
    '게시글 상세',
    'pin/detail',
    async () =>
      toPinDetail(usesMock('pin/detail') ? await fetchMockPinDetail(pinId) : await requestPinDetail(pinId)),
    (detail) => ({
      pinId,
      장소: detail.place.name,
      접근: detail.videoAccess,
      평가함: detail.isEvaluated,
      채팅: `${detail.chatRequestState}${detail.canRequestChat ? ' · 요청가능' : ''}`,
      영상: detail.videoUrl === null ? '없음' : '발급됨',
    }),
  );
}
