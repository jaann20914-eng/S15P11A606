import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/api/client';
import { getRecommendations } from '@/api/recommend/places';
import type { CrowdFilter } from '@/constants/crowdLevels';
import { useCurrentLocation } from '@/hooks/useCurrentLocation';
import type { RecommendationsResponse, RecommendedPlace } from '@/types/recommend';
import { withMinimumDuration } from '@/utils/promise';
import { rememberRecommendedPlaces } from '../placeCache';

export interface RecommendationsState {
  /** 지금 고른 계열. 여유·와글 토글이 이 값을 바꾼다. */
  mode: CrowdFilter;
  /** 고른 계열의 장소 목록. */
  places: RecommendedPlace[];
  /** 추천을 만든 시각(ISO 8601). 아직 못 받았으면 null. */
  generatedAt: string | null;
  /** 위치를 못 써서 인기순으로 대신했는지. 화면에서 그 사실을 알려준다. */
  isFallback: boolean;
  loading: boolean;
  /** 실패 문구. 성공하면 null. */
  error: string | null;
  setMode: (mode: CrowdFilter) => void;
}

/** 오류 코드별 안내. */
const messageByCode: Record<string, string> = {
  INVALID_LOCATION: '위치 정보가 올바르지 않아요.',
  UNAUTHORIZED: '로그인이 필요해요.',
  RECOMMENDATION_FETCH_FAILED: '추천 장소를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.',
  AI_RECOMMENDATION_FAILED: '추천을 만들지 못했어요. 잠시 후 다시 시도해 주세요.',
};

/** 첫 조회에서 로딩 표시를 최소한 이만큼 유지한다. 이유는 `withMinimumDuration` 참고. */
const MIN_LOADING_MS = 500;

/**
 * 추천 장소.
 *
 * **한 번만 조회한다.** 서버가 여유·와글 두 목록을 한 응답으로 주므로 토글을 바꿔도 다시
 * 부르지 않는다. 매번 부르면 같은 데이터를 반복해서 받고, 그 사이 추천이 새로 계산되면
 * 토글을 오갈 때마다 목록이 달라져 보인다.
 *
 * 좌표는 있으면 보내고 없으면 생략한다. 서버가 최근 GPS 캐시로 대신하고, 그것도 없으면
 * 인기순으로 답한다 — 오류가 아니므로 화면은 그대로 목록을 그린다.
 */
export function useRecommendations(): RecommendationsState {
  const [mode, setModeState] = useState<CrowdFilter>('relaxed');
  const [data, setData] = useState<RecommendationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { request: requestLocation } = useCurrentLocation();

  /** 이미 조회했는지. 화면이 다시 그려져도 두 번 부르지 않는다. */
  const requested = useRef(false);

  useEffect(() => {
    if (requested.current) return;
    requested.current = true;

    // 좌표를 못 받아도 요청은 보낸다. 그때는 서버가 캐시나 인기순으로 답한다.
    const load = requestLocation().then((coordinate) =>
      getRecommendations(coordinate === null ? {} : coordinate),
    );

    withMinimumDuration(load, MIN_LOADING_MS)
      .then((received) => {
        // 상세 화면이 같은 값을 다시 받지 않도록 적어 둔다.
        rememberRecommendedPlaces(received);
        setData(received);
        setLoading(false);
      })
      .catch((cause: unknown) => {
        setLoading(false);
        setError(
          cause instanceof ApiError
            ? (messageByCode[cause.code] ?? cause.message)
            : '추천 장소를 불러오지 못했어요',
        );
      });
  }, [requestLocation]);

  return {
    mode,
    places: data?.recommendations[mode] ?? [],
    generatedAt: data?.generatedAt ?? null,
    isFallback: data?.recommendationType === 'POPULAR_FALLBACK',
    loading,
    error,
    setMode: useCallback((next: CrowdFilter) => setModeState(next), []),
  };
}
