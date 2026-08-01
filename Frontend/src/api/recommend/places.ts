import { apiRequest } from '../client';
import { usesMock } from '../config';
import { fetchMockRecommendations } from '@/mocks/recommend';
import type { RecommendationsQuery, RecommendationsResponse } from '@/types/recommend';

/**
 * 개인화 장소 추천 — `GET /api/v1/recommendations/places`
 *
 * 여유·와글 두 목록을 한 번에 준다. 토글을 바꿀 때 다시 부르지 않는다.
 *
 * 좌표는 둘 다 보내거나 둘 다 생략한다. 생략하면 서버가 최근 GPS 캐시를 쓰고, 그것도 없으면
 * 인기순으로 대신한다. 그 경우에도 200이 오고 `recommendationType`이 `POPULAR_FALLBACK`이
 * 되므로 화면은 오류로 다루지 않는다.
 *
 * 오류 코드: `INVALID_LOCATION` `UNAUTHORIZED` `RECOMMENDATION_FETCH_FAILED`
 * `AI_RECOMMENDATION_FAILED`.
 */
function requestRecommendations(query: RecommendationsQuery): Promise<RecommendationsResponse> {
  return apiRequest<RecommendationsResponse>({
    method: 'GET',
    url: '/api/v1/recommendations/places',
    params: query,
  });
}

export async function getRecommendations(
  query: RecommendationsQuery,
): Promise<RecommendationsResponse> {
  if (usesMock('recommend/places')) return fetchMockRecommendations(query);
  return requestRecommendations(query);
}
