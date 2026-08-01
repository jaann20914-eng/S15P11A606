import { apiRequest } from '../client';
import { usesMock } from '../config';
import { fetchMockRecentSearches } from '@/mocks/place';
import type { RecentSearch } from '@/types/place';

/**
 * 최근 검색기록 — `GET /api/v1/places/search/recent`
 *
 * 응답의 `data`가 객체가 아니라 **배열**이다. 다른 목록 API처럼 `{ items: [...] }`로 감싸지
 * 않으므로 타입을 그렇게 적으면 조용히 빈 목록이 된다.
 *
 * 기록은 서버가 쌓는다 — 장소 확정과 태그 확정이 각각 저장하므로 등록 API는 없다. 같은
 * (유형, 키워드)는 서버가 최신 하나만 남긴다.
 *
 * **삭제 API는 아직 없다.** 시안에는 항목마다 ✕가 있으나 눌러도 되돌릴 방법이 없으므로,
 * 화면을 붙일 때 이 점을 어떻게 다룰지 정해야 한다.
 *
 * `limit`은 1 이상 50 이하여야 하고 벗어나면 400 `INVALID_LIMIT`이다. 생략하면 서버가 20을
 * 쓴다(`RecentSearchService`).
 *
 * 오류 코드: `INVALID_LIMIT` `UNAUTHORIZED` `RECENT_SEARCHES_FETCH_FAILED`.
 */
export async function getRecentSearches(limit?: number): Promise<RecentSearch[]> {
  if (usesMock('place/search-recent')) return fetchMockRecentSearches(limit);

  return apiRequest<RecentSearch[]>({
    method: 'GET',
    url: '/api/v1/places/search/recent',
    // undefined는 axios가 쿼리에서 빼 준다. 그러면 서버 기본값이 쓰인다.
    params: { limit },
  });
}
