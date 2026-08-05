import { getCrowdLevelByValue } from '@/constants/crowdLevels';
import { toServerCrowdLevel } from '@/types/pin';
import type { PinDraft, PinUpdateRequest } from '@/types/pinCreate';
// 좌표 끌어당김을 되살릴 때 pullCoordinateNear를 함께 import한다(아래 주석 참고).

/**
 * 수정 요청 본문을 만든다.
 *
 * 수정은 **바뀐 것만** 보낸다(PATCH). 화면의 현재 값을 전부 실어 보내면 두 가지가 어긋난다.
 * - 손대지 않은 값도 "바꿨다"로 기록돼 `updatedFields`가 부풀고, 혼잡도가 그대로여도 서버가
 *   장소 점수를 다시 계산한다
 * - 비운 것과 건드리지 않은 것을 구분할 수 없다. 서버는 `null`을 "지워라"로 읽는다
 *
 * 그래서 처음 불러온 값(`initial`)과 지금 값(`draft`)을 비교해 달라진 것만 담는다.
 *
 * 장소는 **내부 식별자를 가진 것만** 보낼 수 있다. 서버가 `placeId`(정수)만 받기 때문이다.
 * 그래서 수정 화면은 카카오 검색이 아니라 우리 장소 목록에서 고른다(`PlaceEditField`).
 *
 * 촬영 좌표는 영상을 다시 찍었을 때만 함께 보낸다. 영상이 바뀌면 찍은 자리도 바뀌기 때문이다.
 */
export function toPinUpdateRequest(
  initial: PinDraft,
  draft: PinDraft,
  originalVideoKey?: string,
): PinUpdateRequest {
  const body: PinUpdateRequest = {};

  /*
    장소를 옮겼을 때만 담는다.

    내부 식별자를 가진 장소만 보낼 수 있다. 수정 화면이 우리 장소 목록에서만 고르게 하므로
    보통은 이 조건에 걸리지 않지만, 형태로 한 번 더 막아 둔다.

    촬영 좌표는 함께 보내지 않는다(영상을 다시 찍은 경우가 아니라면). 서버는 기존 촬영 좌표와
    새 장소의 거리를 재는데, 후보를 원래 장소 기준 50m로 좁혀 두어도 촬영 좌표가 그 반대편에
    있으면 50m를 넘을 수 있다. 그때는 서버가 `LOCATION_OUT_OF_RANGE`로 거절하고 화면이 그
    이유를 그대로 알린다.
  */
  if (
    draft.place?.source === 'internal' &&
    (initial.place?.source !== 'internal' || draft.place.placeId !== initial.place.placeId)
  ) {
    body.placeId = draft.place.placeId;
  }

  if (draft.crowdLevel !== initial.crowdLevel) {
    body.crowdLevel = toServerCrowdLevel(getCrowdLevelByValue(draft.crowdLevel).key);
  }

  // 빈 문자열은 "지워라"다. 서버가 그렇게 읽도록 null로 바꿔 보낸다.
  const memo = draft.memo.trim();
  if (memo !== initial.memo.trim()) body.memo = memo === '' ? null : memo;

  const detailLocation = draft.detailLocation.trim();
  if (detailLocation !== initial.detailLocation.trim()) {
    body.detailLocation = detailLocation === '' ? null : detailLocation;
  }

  // 순서까지 그대로여야 같은 것으로 본다. 태그는 화면에 넣은 순서대로 보인다.
  const sameTags =
    draft.tags.length === initial.tags.length &&
    draft.tags.every((tag, index) => tag === initial.tags[index]);
  if (!sameTags) body.tags = draft.tags;

  if (originalVideoKey !== undefined) {
    body.originalVideoKey = originalVideoKey;

    // 새로 찍은 자리를 함께 보낸다. 좌표는 둘 다 있어야 하고, 없으면 아예 보내지 않는다.
    const captured = draft.video?.coordinate;
    if (captured) {
      /*
        개발 중 서버의 50m 검증을 피하려고 좌표를 장소 쪽으로 끌어당겨 보냈던 처치는
        껐다(2026-08-06) — 실제 좌표를 그대로 보낸다. 실기기 없이 시험할 때만 아래 줄로 바꾼다.
      */
      // const sent = draft.place ? pullCoordinateNear(captured, draft.place, 30) : captured;
      const sent = captured;
      body.latitude = sent.latitude;
      body.longitude = sent.longitude;
    }
  }

  return body;
}

/** 보낼 것이 하나라도 있는지. 없으면 서버가 400으로 막으므로 요청하지 않는다. */
export function hasPinUpdate(body: PinUpdateRequest): boolean {
  return Object.keys(body).length > 0;
}
