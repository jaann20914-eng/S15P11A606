import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/api/client';
import type { CrowdFilter } from '@/constants/crowdLevels';
import { fetchMockRecommendations } from '@/mocks/recommend';
import type { Recommendation } from '@/types/recommend';
import { withMinimumDuration } from '@/utils/promise';

export interface RecommendationsState {
  /** 지금 고른 계열. 여유·와글 토글이 이 값을 바꾼다. */
  mode: CrowdFilter;
  /** 받아온 추천. 첫 조회가 끝나기 전에는 null. */
  recommendation: Recommendation | null;
  loading: boolean;
  /** 실패 문구. 성공하면 null. */
  error: string | null;
  setMode: (mode: CrowdFilter) => void;
}

/** 첫 조회에서 로딩 표시를 최소한 이만큼 유지한다. 이유는 `withMinimumDuration` 참고. */
const MIN_LOADING_MS = 500;

/**
 * 추천 장소 목록.
 *
 * 계열을 바꾸면 다시 받아온다. 어느 장소를 추천할지는 서버가 정하므로 화면이 목록을 걸러 내지
 * 않는다 — 취향과 현재 위치를 함께 보는 판단이라 프론트가 흉내낼 수 없다.
 *
 * API가 아직 없어 목업을 쓴다. 명세가 나오면 `api/`에 모듈을 만들고 이 훅의 호출부만 바꾼다.
 */
export function useRecommendations(): RecommendationsState {
  const [mode, setModeState] = useState<CrowdFilter>('relaxed');
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** 지금 유효한 조회의 번호. 계열을 빠르게 바꿀 때 뒤늦게 온 응답을 버린다. */
  const requestId = useRef(0);

  useEffect(() => {
    const id = requestId.current + 1;
    requestId.current = id;

    setLoading(true);
    setError(null);

    withMinimumDuration(fetchMockRecommendations(mode), MIN_LOADING_MS)
      .then((received) => {
        if (requestId.current !== id) return;

        setRecommendation(received);
        setLoading(false);
      })
      .catch((cause: unknown) => {
        if (requestId.current !== id) return;

        setLoading(false);
        setError(
          cause instanceof ApiError ? cause.message : '추천 장소를 불러오지 못했어요',
        );
      });
  }, [mode]);

  return {
    mode,
    recommendation,
    loading,
    error,
    setMode: useCallback((next: CrowdFilter) => setModeState(next), []),
  };
}
