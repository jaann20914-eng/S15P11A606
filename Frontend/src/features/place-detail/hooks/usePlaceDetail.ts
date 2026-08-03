import { useEffect, useRef, useState } from 'react';
import { ApiError } from '@/api/client';
import { getPlaceDetail } from '@/api/place/detail';
import type { PlaceDetail } from '@/types/place';
import { withMinimumDuration } from '@/utils/promise';

/** 오류 코드별 안내. */
const messageByCode: Record<string, string> = {
  INVALID_PLACE_ID: '장소 정보가 올바르지 않아요.',
  UNAUTHORIZED: '로그인이 필요해요.',
  PLACE_NOT_FOUND: '장소를 찾을 수 없어요.',
  PLACE_DETAIL_FETCH_FAILED: '장소 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.',
};

/** 로딩 표시를 최소한 이만큼 유지한다. 이유는 `withMinimumDuration` 참고. */
const MIN_LOADING_MS = 400;

export interface PlaceDetailState {
  detail: PlaceDetail | null;
  loading: boolean;
  /** 실패 문구. 성공하면 null. */
  error: string | null;
}

/**
 * 홈 지도 위에 겹치는 장소 화면이 보여줄 장소 한 곳.
 *
 * 기본정보 · 활성 핀 카드 · 요일별 혼잡 통계가 `GET /api/v1/places/{placeId}` 하나로 온다.
 *
 * **좌표는 받지 않는다.** 이 화면은 자기 지도를 만들지 않고 아래 깔린 홈 지도를 그대로 쓴다.
 * 홈이 카드를 누른 시점에 이미 그 장소로 옮겨 두므로 여기서 다시 옮길 필요가 없다. 추천 상세는
 * 자기 지도를 그려야 해서 `resolvePlaceMapData`로 좌표까지 따로 구한다 — 그 차이 때문에 훅을
 * 같이 쓰지 않는다.
 */
export function usePlaceDetail(placeId: number | null): PlaceDetailState {
  const [detail, setDetail] = useState<PlaceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** 이미 조회했는지. 화면이 다시 그려져도 두 번 부르지 않는다. */
  const requested = useRef(false);

  useEffect(() => {
    if (placeId === null) {
      setLoading(false);
      setError('장소를 찾을 수 없어요.');
      return;
    }
    if (requested.current) return;
    requested.current = true;

    withMinimumDuration(getPlaceDetail(placeId), MIN_LOADING_MS)
      .then((received) => {
        setDetail(received);
        setLoading(false);
      })
      .catch((cause: unknown) => {
        setLoading(false);
        setError(
          cause instanceof ApiError
            ? (messageByCode[cause.code] ?? cause.message)
            : '장소 정보를 불러오지 못했어요',
        );
      });
  }, [placeId]);

  return { detail, loading, error };
}
