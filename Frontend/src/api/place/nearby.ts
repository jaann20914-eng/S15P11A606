import { apiRequest } from '../client';
import { usesMock } from '../config';
import { listMockNearbyPlaces } from '@/mocks/place';
import type { PlaceSearchItem, PlaceSearchResponse } from '@/types/place';

/**
 * 지금 서 있는 자리의 장소 — `GET /api/v1/places/search` (검색어 없이)
 *
 * 등록 화면의 "현재 위치" 버튼이 쓴다. 사용자가 장소 이름을 몰라도 지금 자리의 장소를 고를 수
 * 있어야 한다 — 처음 가 본 곳에서 이름을 떠올려 입력하게 하는 것이 실제로 가장 걸리는 단계였다.
 *
 * **아직 서버가 검색어 없는 조회를 받지 않는다.** 지금 `q`가 필수라서 좌표만으로는 부를 수
 * 없다. 그래서 이 모듈은 목업으로 두고, 서버가 `q`를 선택으로 바꾸면 `MOCK_OVERRIDES`에서
 * 줄만 지운다 — 요청 모양은 그때와 같게 미리 맞춰 두었다.
 *
 * 반경은 보내지 않는다. 서버가 50m로 고정하며, 그 값이 곧 등록 가능 범위다(촬영 좌표도 그
 * 안이어야 한다).
 *
 * 결과는 `distanceMeters` 오름차순이며, 없으면 빈 배열이다.
 *
 * 오류 코드: `UNAUTHORIZED` `EXTERNAL_PLACE_API_UNAVAILABLE`(재시도 가능).
 */
async function requestNearbyPlaces(
  latitude: number,
  longitude: number,
): Promise<PlaceSearchItem[]> {
  const response = await apiRequest<PlaceSearchResponse>({
    method: 'GET',
    url: '/api/v1/places/search',
    params: { latitude, longitude },
  });

  return response.places;
}

export function getNearbyPlaces(latitude: number, longitude: number): Promise<PlaceSearchItem[]> {
  if (usesMock('place/nearby')) return listMockNearbyPlaces(latitude, longitude);
  return requestNearbyPlaces(latitude, longitude);
}
