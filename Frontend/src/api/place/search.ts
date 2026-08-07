import { apiRequest } from '../client';
import { usesMock } from '../config';
import { searchMockPlaces } from '@/mocks/place';
import type { PlaceSearchItem, PlaceSearchResponse } from '@/types/place';

/**
 * 좌표 주변 장소 검색 — `GET /api/v1/places/search` (인증 필요)
 *
 * 쓰임이 둘이고 반경만 다르다.
 * - **핀 등록**: `radius`를 보내지 않는다. 서버가 50m로 고정해 "지금 서 있는 자리"의 장소만
 *   준다. 등록 요청의 촬영 좌표도 그 안에 들어와야 하므로 이 반경이 곧 등록 가능 범위다
 * - **검색바**: 가려는 곳을 찾는 자리라 50m로는 대부분 빈 결과가 된다. 호출부가 넓은 반경을
 *   직접 넘긴다(`WIDE_PLACE_SEARCH_RADIUS_M`)
 *
 * 검색어는 앞뒤 공백을 지운 뒤 2자 이상일 때만, 입력이 멈추고 `PLACE_SEARCH_DEBOUNCE_MS`
 * 뒤에 부른다.
 * 두 조건 모두 호출부(`usePlaceSearch`)가 지킨다.
 *
 * 결과는 `distanceMeters` 오름차순이며, 없으면 빈 배열이다.
 *
 * 오류 코드: `INVALID_PLACE_SEARCH_QUERY` `UNAUTHORIZED`
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
