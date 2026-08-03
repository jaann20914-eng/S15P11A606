import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '@/api/client';
import { getRecentSearches } from '@/api/place/recentSearches';
import type { RecentSearch } from '@/types/place';

/** 오류 코드별 안내. */
const messageByCode: Record<string, string> = {
  INVALID_LIMIT: '검색기록을 불러오지 못했어요.',
  UNAUTHORIZED: '로그인이 필요해요.',
  RECENT_SEARCHES_FETCH_FAILED: '최근 검색기록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.',
};

export interface RecentSearchesState {
  items: RecentSearch[];
  loading: boolean;
  /** 실패 문구. 성공하면 null. */
  error: string | null;
  reload: () => void;
}

/**
 * 최근 검색기록 — `GET /api/v1/places/search/recent`
 *
 * 기록을 남기는 일은 프론트가 하지 않는다. 장소 확정과 태그 확정이 각각 서버에서 저장하므로
 * (`search_type` = `PLACE` / `TAG`) 등록 API가 없다. 여기서는 읽기만 한다.
 *
 * 삭제도 없다. 시안에는 항목마다 ✕가 있으나 개별·전체 삭제 API가 아직 없어, 눌러도 다음
 * 조회에서 되살아난다. 그래서 화면에도 버튼을 두지 않았다.
 *
 * 서버가 (유형, 키워드) 기준으로 중복을 제거해 최신순으로 주므로 프론트가 다시 정리하지 않는다.
 */
export function useRecentSearches(): RecentSearchesState {
  const [items, setItems] = useState<RecentSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError(null);

    getRecentSearches()
      .then((recent) => {
        if (!active) return;
        setItems(recent);
        setLoading(false);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setItems([]);
        setLoading(false);
        setError(
          cause instanceof ApiError
            ? (messageByCode[cause.code] ?? cause.message)
            : '최근 검색기록을 불러오지 못했어요',
        );
      });

    return () => {
      active = false;
    };
  }, [reloadCount]);

  return {
    items,
    loading,
    error,
    reload: useCallback(() => setReloadCount((count) => count + 1), []),
  };
}
