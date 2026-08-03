import { useCallback, useState } from 'react';
import type { CrowdLevelValue } from '@/constants/crowdLevels';
import { EMPTY_PIN_DRAFT, MAX_PLACE_DISTANCE_METERS, MAX_TAG_COUNT, MAX_TAG_LENGTH } from '@/types/pinCreate';
import { countGraphemes } from '@/utils/graphemes';
import { distanceBetween } from '@/utils/location';
import type { PinDraft, PinDraftPlace, PinDraftVideo } from '@/types/pinCreate';

export interface PinCreateForm {
  draft: PinDraft;
  reset: () => void;
  setCrowdLevel: (level: CrowdLevelValue) => void;
  setVideo: (video: PinDraftVideo | null) => void;
  /**
   * 촬영 자리에서 너무 멀어 선택이 취소된 장소 이름. 없으면 null.
   *
   * 화면이 이 값으로 "다시 골라 주세요"를 안내한다. 사용자가 다시 고르면 사라진다.
   */
  droppedPlaceName: string | null;
  setMemo: (memo: string) => void;
  addTag: (raw: string) => void;
  removeTag: (tag: string) => void;
  setPlace: (place: PinDraftPlace | null) => void;
  setDetailLocation: (value: string) => void;
  /** 필수값이 모두 채워졌는지. 등록 버튼을 누를 수 있는지 판단한다. */
  canSubmit: boolean;
}

const emptyDraft: PinDraft = {
  crowdLevel: 1,
  video: null,
  memo: '',
  tags: [],
  place: null,
  detailLocation: '',
};

/**
 * 작성 폼의 입력값을 모은다.
 *
 * 화면 컴포넌트는 이 훅이 준 것만 쓰고 자체 `useState`를 두지 않는다.
 * 수정 진입일 때는 서버에서 받은 기존 값을 `initial`로 넣어 시작한다.
 */
export function usePinCreateForm(initial?: Partial<PinDraft>): PinCreateForm {
  const [draft, setDraft] = useState<PinDraft>({ ...EMPTY_PIN_DRAFT, ...initial });
  const [droppedPlaceName, setDroppedPlaceName] = useState<string | null>(null);

  const reset = useCallback(() => {
    setDraft({ ...EMPTY_PIN_DRAFT, ...initial });
    setDroppedPlaceName(null);
  }, [initial]);

  const patch = useCallback(
    (change: Partial<PinDraft>) => setDraft((current) => ({ ...current, ...change })),
    [],
  );

  /**
   * 촬영 결과를 담는다. 이때 이미 고른 장소가 촬영 자리에서 먼지 확인한다.
   *
   * 등록 요청에 실리는 좌표는 **찍은 자리**이고, 서버는 그 좌표가 장소에서 50m 이내인지 보고
   * 아니면 거절한다. 검색해서 고른 뒤 자리를 옮겨 찍으면 그 상황이 된다. 등록 버튼을 누른
   * 뒤에 알려 주면 이미 늦으므로, 찍는 즉시 선택을 비우고 다시 고르게 한다.
   *
   * 좌표를 얻지 못했으면(권한 거부 등) 판단하지 않는다. 확인할 수 없다는 이유로 사용자가 고른
   * 것을 지우면, 위치를 못 읽는 기기에서는 아무 장소도 고를 수 없게 된다.
   */
  const setVideo = useCallback((video: PinDraftVideo | null) => {
    setDraft((current) => {
      const captured = video?.coordinate;
      if (!captured || !current.place) return { ...current, video };

      const distance = distanceBetween(captured, {
        latitude: current.place.latitude,
        longitude: current.place.longitude,
      });
      if (distance <= MAX_PLACE_DISTANCE_METERS) return { ...current, video };

      setDroppedPlaceName(current.place.name);
      return { ...current, video, place: null };
    });
  }, []);

  const addTag = useCallback((raw: string) => {
    // 사용자가 직접 `#`을 붙여도 저장값에는 넣지 않는다. 서버도 공백을 지운 값을 기준으로 본다.
    const value = raw.replace(/^\s*#/, '').trim();

    // 빈 문자열과 길이 초과는 서버가 거부한다. 보내기 전에 막는다.
    if (!value || countGraphemes(value) > MAX_TAG_LENGTH) return;

    setDraft((current) => {
      if (current.tags.length >= MAX_TAG_COUNT || current.tags.includes(value)) return current;
      return { ...current, tags: [...current.tags, value] };
    });
  }, []);

  const removeTag = useCallback((tag: string) => {
    setDraft((current) => ({ ...current, tags: current.tags.filter((item) => item !== tag) }));
  }, []);

  return {
    draft,
    reset,
    droppedPlaceName,
    setCrowdLevel: useCallback((crowdLevel: CrowdLevelValue) => patch({ crowdLevel }), [patch]),
    setVideo,
    setMemo: useCallback((memo: string) => patch({ memo }), [patch]),
    addTag,
    removeTag,
    setPlace: useCallback(
      (place: PinDraftPlace | null) => {
        // 다시 골랐으면 지웠던 이유를 더 보여줄 필요가 없다.
        setDroppedPlaceName(null);
        patch({ place });
      },
      [patch],
    ),
    setDetailLocation: useCallback((detailLocation: string) => patch({ detailLocation }), [patch]),
    // 영상과 장소는 필수다. 갤러리 영상을 막기 위해 촬영 결과가 반드시 있어야 한다.
    canSubmit: draft.video !== null && draft.place !== null,
  };
}
