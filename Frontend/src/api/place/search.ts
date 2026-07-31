import { apiRequest } from '../client';
import { usesMock } from '../config';
import { searchMockPlaces } from '@/mocks/place';
import type { PlaceSearchItem, PlaceSearchResponse } from '@/types/place';

/**
 * 반경 50m 주변 장소 검색 — `GET /api/v1/places/search`
 *
 * `radius`를 보내지 않으면 서버가 50m로 통일한다.
 * 결과는 `distanceMeters` 오름차순이며, 없으면 빈 배열이다.
 *
 * 오류 코드: `INVALID_PLACE_SEARCH_QUERY` `UNAUTHORIZED`
 * `EXTERNAL_PLACE_API_UNAVAILABLE`(재시도 가능).
 */
function requestPlaceSearch(
  query: string,
  latitude: number,
  longitude: number,
): Promise<PlaceSearchResponse> {
  return apiRequest<PlaceSearchResponse>({
    method: 'GET',
    url: '/api/v1/places/search',
    params: { q: query, latitude, longitude },
  });
}

/**
 * 검색어는 앞뒤 공백을 지운 값을 보낸다. 서버가 빈 문자열을 400으로 막으므로
 * 호출 전에 최소 길이를 확인하는 것은 호출부(`usePlaceSearch`)가 맡는다.
 */
export async function searchPlaces(
  query: string,
  latitude: number,
  longitude: number,
): Promise<PlaceSearchItem[]> {
  const trimmed = query.trim();

  if (usesMock('place/search')) return searchMockPlaces(trimmed);

  const response = await requestPlaceSearch(trimmed, latitude, longitude);
  return response.places;
}
