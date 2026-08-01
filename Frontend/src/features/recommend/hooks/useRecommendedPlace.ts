import { useEffect, useRef, useState } from 'react';
import { ApiError } from '@/api/client';
import { getRecommendations } from '@/api/recommend/places';
import type { RecommendedPlace } from '@/types/recommend';
import { findRecommendedPlace, recallRecommendedPlace, rememberRecommendedPlaces } from '../placeCache';

export interface RecommendedPlaceState {
  place: RecommendedPlace | null;
  loading: boolean;
  /** 실패 문구. 성공하면 null. */
  error: string | null;
}

/**
 * 추천 상세가 보여줄 장소 하나.
 *
 * 목록에서 눌러 들어온 보통의 경우에는 이미 받아 둔 값을 그대로 쓴다(`placeCache`).
 * 로딩도 왕복도 없이 첫 프레임부터 내용이 차 있다.
 *
 * 캐시가 비어 있는 경우 — 앱을 이 주소로 바로 열었거나 목록을 거치지 않고 들어온 경우 —
 * 에만 추천을 직접 조회해 그 안에서 장소를 찾는다. 좌표를 보내지 않는다: 여기서 필요한 것은
 * 개인화된 순서가 아니라 이 장소 한 건이고, 위치 권한을 상세 화면에서 새로 물을 이유도 없다.
 */
export function useRecommendedPlace(placeId: number | null): RecommendedPlaceState {
  const [place, setPlace] = useState<RecommendedPlace | null>(() =>
    placeId === null ? null : recallRecommendedPlace(placeId),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** 이미 조회했는지. 화면이 다시 그려져도 두 번 부르지 않는다. */
  const requested = useRef(false);

  useEffect(() => {
    if (placeId === null) {
      setError('장소를 찾을 수 없어요');
      return;
    }
    // 캐시에서 이미 찾았으면 조회하지 않는다.
    if (place !== null || requested.current) return;

    requested.current = true;
    setLoading(true);

    getRecommendations({})
      .then((received) => {
        rememberRecommendedPlaces(received);
        const found = findRecommendedPlace(received, placeId);
        setPlace(found);
        setError(found === null ? '장소를 찾을 수 없어요' : null);
        setLoading(false);
      })
      .catch((cause: unknown) => {
        setLoading(false);
        setError(cause instanceof ApiError ? cause.message : '장소를 불러오지 못했어요');
      });
  }, [place, placeId]);

  return { place, loading, error };
}
