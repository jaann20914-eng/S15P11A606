import { ApiError } from '@/api/client';
import { MIN_PLACE_QUERY_LENGTH } from '@/types/place';
import type { PlaceSearchItem } from '@/types/place';
import { MOCK_LATENCY_MS, delay } from './pin';

/**
 * 장소 검색 고정 데이터.
 *
 * 백엔드에 `GET /api/v1/places/search`가 붙기 전까지 화면을 돌린다.
 * 실제 API처럼 `distanceMeters` 오름차순으로 주고, 결과가 없으면 빈 배열이다.
 *
 * 화면에서 확인하는 법: 내 위치 칸에 "바나" 또는 "카페"를 입력한다.
 * "오류"를 넣으면 외부 장소 API 장애를 재현한다.
 */
const places: PlaceSearchItem[] = [
  {
    kakaoPlaceId: '1234567890',
    name: '바나프레소 역삼1점',
    address: '서울 광진구 동일로 60길 47 1층 (군자동)',
    latitude: 37.544581,
    longitude: 127.055961,
    distanceMeters: 12,
  },
  {
    kakaoPlaceId: '1234567891',
    name: '바나프레소 역삼점',
    address: '서울 광진구 동일로 60길 47 2층 (군자동)',
    latitude: 37.5447,
    longitude: 127.0561,
    distanceMeters: 24,
  },
  {
    kakaoPlaceId: '1234567892',
    name: '바나프레소 역삼6점',
    address: '서울 광진구 동일로 58길 12 (군자동)',
    latitude: 37.5449,
    longitude: 127.0564,
    distanceMeters: 38,
  },
  {
    kakaoPlaceId: '2234567890',
    name: '스타벅스 군자역점',
    address: '서울 광진구 능동로 234 (군자동)',
    latitude: 37.5551,
    longitude: 127.0794,
    distanceMeters: 31,
  },
  {
    kakaoPlaceId: '3234567890',
    name: '카페 그리다',
    address: '서울 광진구 동일로 58길 12 (군자동)',
    latitude: 37.5452,
    longitude: 127.0566,
    distanceMeters: 45,
  },
  {
    kakaoPlaceId: '4234567890',
    name: '메가커피 세종대점',
    address: '서울 광진구 능동로 209 (화양동)',
    latitude: 37.5503,
    longitude: 127.0742,
    distanceMeters: 49,
  },
];

/** 외부 장소 API 장애 화면을 확인하기 위한 검색어. */
const UNAVAILABLE_QUERY = '오류';

/**
 * 검색 목업.
 *
 * 좌표는 실제 API와 시그니처를 맞추기 위해 받기만 한다. 반경 판정과 거리 계산은
 * 서버가 하므로 목업은 고정된 `distanceMeters`를 그대로 준다.
 */
export async function searchMockPlaces(query: string): Promise<PlaceSearchItem[]> {
  await delay(MOCK_LATENCY_MS);

  const trimmed = query.trim();

  // 서버는 빈 검색어를 400으로 막는다. 호출부가 걸러야 하지만 목업도 같게 동작시킨다.
  if (trimmed.length < MIN_PLACE_QUERY_LENGTH) {
    throw new ApiError(400, 'INVALID_PLACE_SEARCH_QUERY', '장소 검색 조건이 올바르지 않습니다.');
  }

  if (trimmed === UNAVAILABLE_QUERY) {
    throw new ApiError(503, 'EXTERNAL_PLACE_API_UNAVAILABLE', '외부 장소 검색 서비스를 사용할 수 없습니다.');
  }

  return places
    .filter((place) => place.name.includes(trimmed))
    .sort((a, b) => a.distanceMeters - b.distanceMeters);
}
