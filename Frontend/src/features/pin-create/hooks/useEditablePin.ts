import { useEffect, useRef, useState } from 'react';
import { ApiError } from '@/api/client';
import { getPinDetail } from '@/api/pin/detail';
import { getCrowdLevelByKey } from '@/constants/crowdLevels';
import { isOwnPin } from '@/types/pin';
import type { PinId } from '@/types/pin';
import type { PinDraft } from '@/types/pinCreate';

export interface EditablePin {
  /** 수정 시작값. 아직 못 받았으면 null. */
  initial: Partial<PinDraft> | null;
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
  const [initial, setInitial] = useState<Partial<PinDraft> | null>(null);
  const [loading, setLoading] = useState(pinId !== null);
  const [error, setError] = useState<string | null>(null);

  /** 이미 불러왔는지. 화면이 다시 그려져도 두 번 부르지 않는다. */
  const requested = useRef(false);

  useEffect(() => {
    if (pinId === null || requested.current) return;
    requested.current = true;

    getPinDetail(pinId)
      .then((detail) => {
        // 남의 핀은 고칠 수 없다. 서버도 403으로 막지만 화면을 열어 두면 다 쓰고 나서 막힌다.
        if (!isOwnPin(detail)) {
          setLoading(false);
          setError('내가 올린 영상핀만 수정할 수 있어요.');
          return;
        }

        setInitial({
          crowdLevel: getCrowdLevelByKey(detail.crowdLevel).level,
          memo: detail.memo ?? '',
          tags: detail.tags,
          detailLocation: detail.detailLocation ?? '',
          place: {
            source: 'internal',
            placeId: detail.place.placeId,
            name: detail.place.name,
            address: detail.place.address,
            latitude: 0,
            longitude: 0,
          },
        });
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
  }, [pinId]);

  return { initial, loading, error };
}
