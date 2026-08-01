import { apiRequest } from '../client';
import { usesMock } from '../config';
import { searchMockPlaces } from '@/mocks/place';
import type { PlaceSearchItem, PlaceSearchResponse } from '@/types/place';

/**
 * 좌표 주변 장소 검색 — `GET /api/v1/places/search`
 *
 * 인증이 필요 없는 공개 경로다(서버 `SecurityConfig`의 `/api/v1/places/**`).
 *
 * `radius`를 보내지 않으면 서버가 50m를 쓴다. 그 값은 핀 등록용이라 검색바처럼 넓게 찾아야
 * 하는 곳에서는 호출부가 직접 넘긴다(`WIDE_PLACE_SEARCH_RADIUS_M`).
 *
 * 결과는 `distanceMeters` 오름차순이며, 없으면 빈 배열이다.
 *
 * 오류 코드: `INVALID_PLACE_SEARCH_QUERY` `EXTERNAL_PLACE_API_ERROR`
 * `EXTERNAL_PLACE_API_UNAVAILABLE`(재시도 가능).
 */
function requestPlaceSearch(
  query: string,
  latitude: number,
  longitude: number,
  radius?: number,
): Promise<PlaceSearchResponse> {
  return apiRequest<PlaceSearchResponse>({
    method: 'GET',
    url: '/api/v1/places/search',
    // radius를 생략하면 서버 기본값이 쓰인다. undefined는 axios가 쿼리에서 빼 준다.
    params: { q: query, latitude, longitude, radius },
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
  radius?: number,
): Promise<PlaceSearchItem[]> {
  const trimmed = query.trim();

  if (usesMock('place/search')) return searchMockPlaces(trimmed);

  const response = await requestPlaceSearch(trimmed, latitude, longitude, radius);
  return response.places;
}
