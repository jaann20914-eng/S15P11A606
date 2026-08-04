import { apiRequest } from '../client';
import { usesMock } from '../config';
import { listMockNearbyPlaces } from '@/mocks/place';
import type { PlaceNearbyItem, PlaceNearbyResponse } from '@/types/place';

/**
 * 지금 서 있는 자리의 장소 — `GET /api/v1/places/nearby` (인증 필요)
 *
 * 등록 화면의 "현재 위치" 버튼이 쓴다. 사용자가 장소 이름을 몰라도 지금 자리의 장소를 고를 수
 * 있어야 한다 — 처음 가 본 곳에서 이름을 떠올려 입력하게 하는 것이 등록에서 가장 걸리는
 * 단계였다.
 *
 * 검색(`/places/search`)과 쓰임이 다르다. 이쪽은 검색어를 받지 않고 좌표만으로 반경 50m 안의
 * 장소를 거리순으로 준다. 그 반경이 곧 등록 가능 범위다 — 촬영 좌표도 최종 장소와 50m 이내여야
 * 서버가 받아 준다.
 *
 * 응답 항목은 **등록 요청에 실을 값을 그대로** 담고 있다(카테고리 · 전화 · 지번 주소 포함).
 * 고른 것을 그대로 들고 있다가 등록에 넘기면 된다(`types/place.ts`의 `PlaceNearbyItem`).
 *
 * 오류 코드: `INVALID_LOCATION` `UNAUTHORIZED` `EXTERNAL_PLACE_API_UNAVAILABLE`(재시도 가능).
 */
async function requestNearbyPlaces(
  latitude: number,
  longitude: number,
): Promise<PlaceNearbyItem[]> {
  const response = await apiRequest<PlaceNearbyResponse>({
    method: 'GET',
    url: '/api/v1/places/nearby',
    params: { latitude, longitude },
  });

  return response.places;
}

export function getNearbyPlaces(latitude: number, longitude: number): Promise<PlaceNearbyItem[]> {
  if (usesMock('place/nearby')) return listMockNearbyPlaces(latitude, longitude);
  return requestNearbyPlaces(latitude, longitude);
}
