import { useEffect, useRef, useState } from 'react';
import { ApiError } from '@/api/client';
import { getPinDetail } from '@/api/pin/detail';

import { isOwnPin } from '@/types/pin';
import { takeEditablePin, toDraft } from '../editHandoff';
import type { PinId } from '@/types/pin';
import type { PinDraft } from '@/types/pinCreate';

export interface EditablePin {
  /** 수정 시작값. 아직 못 받았으면 null. */
  initial: Partial<PinDraft> | null;
  /**
   * 지금 등록돼 있는 영상.
   *
   * 폼에 담지 않는다 — 폼의 값은 "무엇이 바뀌었는지"를 가리기 위한 것이고, 이 영상은 서버에
   * 이미 있는 것이라 비교 대상이 아니다. 화면은 이 값을 촬영 자리에 보여주고, 사용자가 다시
   * 찍었을 때만 교체 요청이 된다.
   */
  existingVideoUrl: string | null;
  loading: boolean;
  /** 실패 문구. 성공하면 null. */
  error: string | null;
}

/** 오류 코드별 안내. */
const messageByCode: Record<string, string> = {
  UNAUTHORIZED: '로그인이 필요해요.',
  PIN_NOT_FOUND: '수정할 영상핀을 찾을 수 없어요.',
  PIN_DETAIL_FETCH_FAILED: '영상핀을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.',
};

/**
 * 수정할 핀의 기존 값을 불러온다.
 *
 * 수정은 부분 수정(PATCH)이라 **무엇이 바뀌었는지**를 알아야 한다. 그러려면 시작값이
 * 있어야 하고, 그 값이 이 훅이 주는 `initial`이다. 제출할 때 지금 값과 비교해 달라진 것만
 * 보낸다(`toPinUpdateRequest`).
 *
 * 영상은 담지 않는다. 기존 영상은 서버에 있고 기기에는 파일이 없다. 사용자가 다시 찍으면
 * 그때 교체 요청이 된다.
 *
 * 장소는 상세 응답이 주는 내부 장소를 그대로 쓴다. 좌표는 응답에 없어 0으로 둔다 — 수정에서
 * 장소를 바꾸려면 후보를 좌표로 찾아야 하는데, 그 좌표를 받을 방법이 아직 없다.
 */
export function useEditablePin(pinId: PinId | null): EditablePin {
  /*
    상세 화면이 넘겨준 값이 있으면 그것으로 시작한다.

    수정은 게시글 상세에서만 들어오고, 그 화면은 이미 같은 핀을 받아 두었다. 다시 조회하면
    같은 값을 한 번 더 받으려고 사용자를 기다리게 하는 셈이다.
  */
  const [handedOff] = useState(() => (pinId === null ? null : takeEditablePin(pinId)));

  const [initial, setInitial] = useState<Partial<PinDraft> | null>(handedOff?.draft ?? null);
  const [existingVideoUrl, setExistingVideoUrl] = useState<string | null>(
    handedOff?.videoUrl ?? null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** 이미 불러왔는지. 화면이 다시 그려져도 두 번 부르지 않는다. */
  const requested = useRef(false);

  useEffect(() => {
    // 넘겨받은 값이 있으면 조회하지 않는다.
    if (pinId === null || initial !== null || requested.current) return;
    requested.current = true;
    setLoading(true);

    getPinDetail(pinId)
      .then((detail) => {
        // 남의 핀은 고칠 수 없다. 서버도 403으로 막지만 화면을 열어 두면 다 쓰고 나서 막힌다.
        if (!isOwnPin(detail)) {
          setLoading(false);
          setError('내가 올린 영상핀만 수정할 수 있어요.');
          return;
        }

        setInitial(toDraft(detail));
        setExistingVideoUrl(detail.videoUrl);
        setLoading(false);
      })
      .catch((cause: unknown) => {
        setLoading(false);
        setError(
          cause instanceof ApiError
            ? (messageByCode[cause.code] ?? cause.message)
            : '영상핀을 불러오지 못했어요',
        );
      });
  }, [initial, pinId]);

  return { initial, existingVideoUrl, loading, error };
}
