import { apiRequest } from '../client';
import { usesMock } from '../config';
import { updateMockPin } from '@/mocks/pin';
import type { PinUpdateRequest, PinUpdateResult } from '@/types/pinCreate';
import type { PinId } from '@/types/pin';
import { tracePin } from './log';

/**
 * 핀 수정 — `PATCH /api/v1/pins/{pinId}`
 *
 * 보낸 필드만 바뀐다. `detailLocation`·`memo`에 `null`을, `tags`에 빈 배열을 보내면 지워진다.
 * 하나도 보내지 않으면 400이다.
 *
 * 영상을 바꾸려면 등록과 같은 순서를 한 번 더 거친다 — 업로드 정보를 발급받아 S3에 올리고,
 * 받은 `originalVideoKey`를 이 요청에 싣는다. 그러면 응답이 202이고 새 영상은 AI 검수를
 * 통과한 뒤에야 교체된다. **그동안 기존 영상은 계속 공개된다**(`videoStatus`는 `ACTIVE`).
 * 검수 결과는 `GET /pins/{pinId}/status`의 `videoReplacementStatus`로 확인한다.
 *
 * 작성자 본인의 `ACTIVE` 핀만 고칠 수 있다.
 *
 * 오류 코드: `INVALID_PIN_UPDATE_REQUEST` `UNAUTHORIZED` `PIN_UPDATE_FORBIDDEN`
 * `PIN_NOT_FOUND` `PLACE_NOT_FOUND` `PIN_NOT_EDITABLE` `PIN_UPDATE_IN_PROGRESS`
 * `VIDEO_ALREADY_REGISTERED` `LOCATION_OUT_OF_RANGE` `VIDEO_NOT_ACCESSIBLE`
 * `PIN_UPDATE_FAILED`.
 */
function requestPinUpdate(pinId: PinId, body: PinUpdateRequest): Promise<PinUpdateResult> {
  return apiRequest<PinUpdateResult>({
    method: 'PATCH',
    url: `/api/v1/pins/${pinId}`,
    data: body,
  });
}

export function updatePin(pinId: PinId, body: PinUpdateRequest): Promise<PinUpdateResult> {
  return tracePin(
    '게시글 수정',
    'pin/update',
    () => (usesMock('pin/update') ? updateMockPin(pinId, body) : requestPinUpdate(pinId, body)),
    (result) => ({
      pinId,
      보낸필드: Object.keys(body).join(', ') || '없음',
      바뀐필드: result.updatedFields?.join(', ') ?? '없음',
      영상교체: result.videoReplacementStatus ?? '없음',
    }),
  );
}
