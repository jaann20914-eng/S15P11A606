import { apiRequest } from '../client';
import { usesMock } from '../config';
import { fetchMockPlaces } from '@/mocks/place';
import type { PlacesQuery, PlacesResponse } from '@/types/place';

/**
 * 지도 범위 내 장소·활성핀 목록 — `GET /api/v1/places`
 *
 * 지도 경계 네 좌표를 함께 보낸다. 남서가 북동보다 작아야 하며, 어기면 `INVALID_MAP_RANGE`가
 * 온다. `filter`를 생략하면 혼잡도와 관계없이 조회한다.
 *
 * 좌표를 주는 유일한 엔드포인트다. 장소 상세(`/places/{placeId}`)에는 위도·경도가 없어
 * 지도에 장소를 찍으려면 이쪽을 거쳐야 한다(`coordinates.ts`).
 *
 * 오류 코드: `INVALID_MAP_RANGE` `INVALID_PLACE_FILTER` `UNAUTHORIZED` `PLACES_FETCH_FAILED`.
 */
export async function getPlaces(query: PlacesQuery): Promise<PlacesResponse> {
  if (usesMock('place/list')) return fetchMockPlaces(query);

  return apiRequest<PlacesResponse>({
    method: 'GET',
    url: '/api/v1/places',
    params: query,
  });
}
