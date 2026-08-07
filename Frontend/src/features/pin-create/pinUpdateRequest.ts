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
 * 장소는 **지금 화면에서 바꿀 수 없다**(`PlaceEditField` — 등록할 때의 값을 보여주기만 한다).
 * 서버가 `placeId`(우리 DB의 정수)만 받는데 등록 화면이 쓰는 주변 조회는 카카오 식별자만 주어,
 * 두 화면이 같은 목록을 보여줄 수가 없었다. 아래 장소 비교는 그래서 지금은 늘 거짓이다.
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

    **지금은 화면에서 장소를 바꿀 수 없어 이 조건에 걸리지 않는다.** 그래도 남겨 둔다 —
    수정 API가 카카오 식별자를 받게 되어 옮기기가 돌아오면 그때 필요한 자리이고, 그 사이에
    다른 경로로 장소가 바뀌어 들어와도 내부 식별자가 아닌 값은 여기서 걸러진다.
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
