import { ApiError } from '@/api/client';
import { DAYS_OF_WEEK, MIN_PLACE_QUERY_LENGTH } from '@/types/place';
import type {
  DayCrowdStat,
  PlaceDetailResponse,
  PlaceListItem,
  PlacePinCardResponse,
  PlaceSearchItem,
  PlacesQuery,
  PlacesResponse,
} from '@/types/place';
import { MOCK_LATENCY_MS, delay, mockPinId } from './pin';
import {
  averageCrowdLevelOf,
  findMockPlaceSeed,
  mockPlaceSeeds,
  WAGLE_FROM_LEVEL,
  type MockPinSeed,
  type MockPlaceSeed,
} from './placeSeeds';

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

/* ------------------------------------------------------------------ *
 * 장소 목록 · 장소 상세
 * ------------------------------------------------------------------ */

/**
 * 목업에서 눌러볼 수 있는 핀 시나리오 수(`mocks/pin.ts`의 1~6번).
 *
 * 장소 상세의 핀 카드는 이 번호를 그대로 쓴다. 장소마다 다른 식별자를 만들면 시나리오 표에
 * 없어 눌렀을 때 전부 조회 실패가 된다. 실기에서는 주소를 칠 수 없어 목록이 유일한 진입
 * 경로라, 여섯 상황을 여기서 다 열어볼 수 있어야 한다.
 */
const MOCK_PIN_SCENARIO_COUNT = 6;

/** 시나리오별 열람 여부. `mocks/pin.ts`의 1~6번 순서와 같다. */
const UNLOCKED_BY_SCENARIO = [false, true, true, true, false, true];

/** 평균 혼잡 단계 → 표시 구간. 명세의 기준(3.0 이상이 WAGLE)을 그대로 쓴다. */
function toCrowdLabel(average: number | null): PlaceListItem['crowdLabel'] {
  if (average === null) return null;
  return average >= WAGLE_FROM_LEVEL ? 'WAGLE' : 'RELAXED';
}

function toPinCard(pin: MockPinSeed, index: number): PlacePinCardResponse {
  const scenario = (index % MOCK_PIN_SCENARIO_COUNT) + 1;
  const createdAt = new Date(Date.now() - pin.minutesAgo * 60_000);

  return {
    pinId: mockPinId(scenario),
    nickname: pin.nickname,
    viewAngle: pin.viewAngle,
    createdAt: createdAt.toISOString(),
    memo: pin.memo,
    tags: pin.tags,
    isUnlocked: UNLOCKED_BY_SCENARIO[scenario - 1],
    // Object Storage가 붙기 전이라 썸네일은 아직 없다. 화면은 자리만 비워 둔다.
    videoThumbnailUrl: null,
  };
}

function toListItem(seed: MockPlaceSeed): PlaceListItem {
  const average = averageCrowdLevelOf(seed);

  return {
    placeId: seed.placeId,
    name: seed.name,
    address: seed.address,
    phone: seed.phone,
    latitude: seed.latitude,
    longitude: seed.longitude,
    averageCrowdLevel: average,
    crowdLabel: toCrowdLabel(average),
    activePins: seed.pins.map((pin, index) => ({
      pinId: mockPinId((index % MOCK_PIN_SCENARIO_COUNT) + 1),
      // 핀마다 장소 주변 다른 자리에 있다. 전부 같은 점이면 지도에서 겹쳐 하나로 보인다.
      latitude: seed.latitude + pin.latitudeOffset,
      longitude: seed.longitude + pin.longitudeOffset,
      viewAngle: pin.viewAngle,
    })),
  };
}

/**
 * 지도 범위 내 장소 목록 목업.
 *
 * 경계 좌표 안에 드는 장소만 준다. 필터를 주면 평균 혼잡도 구간으로 한 번 더 거른다.
 * 정렬은 지도 중심에서 가까운 순으로, 서버와 같게 맞춘다.
 */
export async function fetchMockPlaces(query: PlacesQuery): Promise<PlacesResponse> {
  await delay(MOCK_LATENCY_MS);

  const centerLatitude = (query.southWestLatitude + query.northEastLatitude) / 2;
  const centerLongitude = (query.southWestLongitude + query.northEastLongitude) / 2;

  const places = mockPlaceSeeds
    .filter(
      (seed) =>
        seed.latitude >= query.southWestLatitude &&
        seed.latitude <= query.northEastLatitude &&
        seed.longitude >= query.southWestLongitude &&
        seed.longitude <= query.northEastLongitude,
    )
    .map(toListItem)
    .filter((place) => {
      if (query.filter === undefined) return true;
      return place.crowdLabel === (query.filter === 'wagle' ? 'WAGLE' : 'RELAXED');
    })
    .sort((a, b) => {
      const distanceA = (a.latitude - centerLatitude) ** 2 + (a.longitude - centerLongitude) ** 2;
      const distanceB = (b.latitude - centerLatitude) ** 2 + (b.longitude - centerLongitude) ** 2;
      return distanceA - distanceB;
    });

  return { places };
}

/** 요일 통계. 집계가 없는 요일도 칸은 그대로 두고 값만 null로 준다. */
function toWeeklyStats(seed: MockPlaceSeed): DayCrowdStat[] {
  return DAYS_OF_WEEK.map((dayOfWeek, index) => ({
    dayOfWeek,
    averageCrowdLevel: seed.weeklyCrowdLevels[index] ?? null,
  }));
}

/**
 * 장소 상세 목업.
 *
 * 없는 `placeId`는 실제 서버와 같이 404로 답한다.
 */
export async function fetchMockPlaceDetail(placeId: number): Promise<PlaceDetailResponse> {
  await delay(MOCK_LATENCY_MS);

  const seed = findMockPlaceSeed(placeId);
  if (seed === null) {
    throw new ApiError(404, 'PLACE_NOT_FOUND', '장소를 찾을 수 없습니다.');
  }

  return {
    place: { placeId: seed.placeId, name: seed.name, address: seed.address, phone: seed.phone },
    pins: seed.pins.map(toPinCard),
    weeklyCrowdStats: toWeeklyStats(seed),
  };
}
