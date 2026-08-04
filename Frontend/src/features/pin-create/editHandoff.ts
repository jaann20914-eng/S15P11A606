import { getCrowdLevelByKey } from '@/constants/crowdLevels';
import type { PinDetail, PinId } from '@/types/pin';
import type { PinDraft } from '@/types/pinCreate';

/**
 * 상세 화면이 수정 화면으로 넘기는 값.
 *
 * 수정은 게시글 상세에서만 들어올 수 있고, 그 화면은 이미 같은 핀을 받아 두었다. 수정 화면이
 * 다시 조회하면 같은 값을 한 번 더 받으려고 사용자를 기다리게 하는 셈이다. 그래서 여기 적어
 * 두고 그대로 쓴다.
 *
 * 라우트 파라미터로 넘기지 않는 이유는 값이 객체이기 때문이다. 파라미터는 문자열이라 통째로
 * 직렬화해 주소에 실어야 하고, 그러면 주소가 길어지고 되돌릴 때 형식이 깨지기 쉽다.
 *
 * 상세를 거치지 않고 들어온 경우(주소로 바로 열기)에는 비어 있고, 그때는 수정 화면이 직접
 * 조회한다.
 */
let handoff: { pinId: PinId; draft: Partial<PinDraft>; videoUrl: string | null } | null = null;

/** 상세에서 받은 핀을 수정 시작값으로 바꿔 적어 둔다. */
export function rememberEditablePin(detail: PinDetail): void {
  // 지금 등록된 영상도 함께 넘긴다. 수정 화면이 그것을 먼저 보여줘야 다시 찍을 일이 없다.
  handoff = { pinId: detail.pinId, draft: toDraft(detail), videoUrl: detail.videoUrl };
}

/**
 * 적어 둔 시작값을 꺼낸다. **한 번만 꺼낼 수 있다.**
 *
 * 남겨 두면 다음에 다른 핀을 수정할 때 지난 값이 먼저 보인다. 꺼내는 즉시 비운다.
 */
export function takeEditablePin(
  pinId: PinId,
): { draft: Partial<PinDraft>; videoUrl: string | null } | null {
  if (handoff === null || handoff.pinId !== pinId) return null;

  const { draft, videoUrl } = handoff;
  handoff = null;
  return { draft, videoUrl };
}

/**
 * 상세 응답을 작성 폼의 값으로 옮긴다.
 *
 * 영상은 담지 않는다. 기존 영상은 서버에 있고 기기에는 파일이 없다. 사용자가 다시 찍으면
 * 그때 교체 요청이 된다.
 */
export function toDraft(detail: PinDetail): Partial<PinDraft> {
  return {
    crowdLevel: getCrowdLevelByKey(detail.crowdLevel).level,
    memo: detail.memo ?? '',
    tags: detail.tags,
    detailLocation: detail.detailLocation ?? '',
    place: {
      source: 'internal',
      placeId: detail.place.placeId,
      name: detail.place.name,
      latitude: detail.place.latitude,
      longitude: detail.place.longitude,
    },
  };
}
