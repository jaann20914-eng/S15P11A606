import { getCrowdLevelByValue } from '@/constants/crowdLevels';
import { toServerCrowdLevel } from '@/types/pin';
import type { PinDraft, PinUpdateRequest } from '@/types/pinCreate';

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
 * **장소는 담지 않는다.** 서버는 내부 `placeId`(정수)만 받는데, 우리 장소 검색은 카카오
 * 식별자를 준다. 검색 결과를 내부 식별자로 바꿀 방법이 없어 이 화면에서는 장소를 바꿀 수
 * 없다. 장소를 옮기려면 지우고 다시 등록해야 한다.
 *
 * 촬영 좌표는 영상을 다시 찍었을 때만 함께 보낸다. 영상이 바뀌면 찍은 자리도 바뀌기 때문이다.
 */
export function toPinUpdateRequest(
  initial: PinDraft,
  draft: PinDraft,
  originalVideoKey?: string,
): PinUpdateRequest {
  const body: PinUpdateRequest = {};

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
      body.latitude = captured.latitude;
      body.longitude = captured.longitude;
    }
  }

  return body;
}

/** 보낼 것이 하나라도 있는지. 없으면 서버가 400으로 막으므로 요청하지 않는다. */
export function hasPinUpdate(body: PinUpdateRequest): boolean {
  return Object.keys(body).length > 0;
}
