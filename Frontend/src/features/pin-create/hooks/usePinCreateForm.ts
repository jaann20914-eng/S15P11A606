import { useCallback, useState } from 'react';
import type { CrowdLevelValue } from '@/constants/crowdLevels';
import { MAX_TAG_COUNT } from '@/types/pinCreate';
import type { PinDraft, PinDraftPlace, PinDraftVideo } from '@/types/pinCreate';

export interface PinCreateForm {
  draft: PinDraft;
  setCrowdLevel: (level: CrowdLevelValue) => void;
  setVideo: (video: PinDraftVideo | null) => void;
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
  const [draft, setDraft] = useState<PinDraft>({ ...emptyDraft, ...initial });

  const patch = useCallback(
    (change: Partial<PinDraft>) => setDraft((current) => ({ ...current, ...change })),
    [],
  );

  const addTag = useCallback((raw: string) => {
    // 사용자가 직접 `#`을 붙여도 저장값에는 넣지 않는다.
    const value = raw.trim().replace(/^#/, '');
    if (!value) return;

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
    setCrowdLevel: useCallback((crowdLevel: CrowdLevelValue) => patch({ crowdLevel }), [patch]),
    setVideo: useCallback((video: PinDraftVideo | null) => patch({ video }), [patch]),
    setMemo: useCallback((memo: string) => patch({ memo }), [patch]),
    addTag,
    removeTag,
    setPlace: useCallback((place: PinDraftPlace | null) => patch({ place }), [patch]),
    setDetailLocation: useCallback((detailLocation: string) => patch({ detailLocation }), [patch]),
    // 영상과 장소는 필수다. 갤러리 영상을 막기 위해 촬영 결과가 반드시 있어야 한다.
    canSubmit: draft.video !== null && draft.place !== null,
  };
}
