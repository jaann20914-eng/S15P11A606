import { ApiError } from '@/api/client';
import { DAYS_OF_WEEK, MIN_PLACE_QUERY_LENGTH, RECENT_SEARCH_MAX_LIMIT } from '@/types/place';
import type {
  DayCrowdStat,
  PlaceDetailResponse,
  PlaceListItem,
  PlacePinCardResponse,
  PlaceNearbyItem,
  PlaceSearchConfirmResponse,
  PlaceSearchItem,
  PlacesQuery,
  PlacesResponse,
  RecentSearch,
  TaggedPinsResponse,
  TagSuggestion,
} from '@/types/place';
import { MOCK_LATENCY_MS, delay, mockPinId } from './pin';
import {
  averageCrowdLevelOf,
  findMockPlaceSeed,
  mockPlaceSeeds,
  mockTagVocabulary,
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
  /*
    아래 넷은 **장소 시드에 실제로 있는 곳**이다(`SEED_PLACE_ID_BY_KAKAO_ID`). 검색해서 고르면
    핀과 요일 통계가 있는 장소로 이어지므로, 시연할 때 검색부터 상세까지 끊기지 않는다.
    좌표도 시드와 같게 두어 지도가 엉뚱한 자리로 가지 않는다.
  */
  {
    kakaoPlaceId: '5234567890',
    name: '성수 연무장길',
    address: '서울 성동구 연무장길',
    latitude: 37.5427,
    longitude: 127.0559,
    distanceMeters: 120,
  },
  {
    kakaoPlaceId: '5234567891',
    name: '연무장길 팝업존',
    address: '서울 성동구 연무장길 24',
    latitude: 37.5412,
    longitude: 127.0552,
    distanceMeters: 260,
  },
  {
    kakaoPlaceId: '5234567892',
    name: '서울숲 산책로',
    address: '서울 성동구 뚝섬로 273',
    latitude: 37.5444,
    longitude: 127.0374,
    distanceMeters: 1580,
  },
  {
    kakaoPlaceId: '5234567893',
    name: '건대 커먼그라운드',
    address: '서울 광진구 아차산로 200',
    latitude: 37.541,
    longitude: 127.0665,
    distanceMeters: 980,
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

/**
 * 핀 카드 하나.
 *
 * `origin`(장소 좌표)을 주면 핀의 오프셋을 더해 **촬영 좌표**까지 채운다. 상세 화면이 그
 * 좌표로 지도에 영상핀 마커를 찍고, 게시물을 오르내릴 때 지도를 그 자리로 옮긴다.
 * 서버는 아직 좌표를 주지 않지만 목업은 가지고 있으니, 시연에서는 그 움직임을 보여줄 수 있다.
 */
function toPinCard(
  pin: MockPinSeed,
  index: number,
  origin?: { latitude: number; longitude: number },
): PlacePinCardResponse {
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
    latitude: origin ? origin.latitude + pin.latitudeOffset : null,
    longitude: origin ? origin.longitude + pin.longitudeOffset : null,
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
    // 장소 좌표를 함께 넘겨 핀마다 촬영 좌표를 채운다. 지도에 영상핀을 찍는 재료다.
    pins: seed.pins.map((pin, index) => toPinCard(pin, index, seed)),
    weeklyCrowdStats: toWeeklyStats(seed),
  };
}

/* ------------------------------------------------------------------ *
 * 장소 검색 확정 · 최근 검색기록 · 태그 검색
 * ------------------------------------------------------------------ */

/**
 * 카카오 장소 → 우리 장소.
 *
 * 실제 서버는 `places` 테이블을 `kakaoPlaceId`로 뒤져 있으면 상세를, 없으면 카카오 정보만
 * 돌려준다. 목업도 두 갈래를 모두 열어 둬야 미등록 장소 화면을 확인할 수 있다.
 *
 * 표에 없는 검색 결과는 전부 미등록 장소로 답한다.
 */
const SEED_PLACE_ID_BY_KAKAO_ID: Record<string, number> = {
  // 바나프레소 역삼1점 → 시드 11번. 등록된 장소지만 핀이 0개인 경우를 볼 수 있다.
  '1234567890': 11,
  // 아래 넷은 핀과 요일 통계가 모두 있는 장소다. 시연은 이쪽으로 하면 화면이 다 찬다.
  '5234567890': 1,
  '5234567891': 5,
  '5234567892': 2,
  '5234567893': 7,
};

/**
 * 장소 검색 확정 목업.
 *
 * 화면에서 확인하는 법: "바나"를 검색해 **역삼1점**을 고르면 등록된 장소(핀·통계 있음),
 * 나머지를 고르면 미등록 장소(`placeId: null`, 빈 배열)가 된다.
 */
export async function confirmMockPlaceSearch(
  kakaoPlaceId: string,
  placeName: string,
): Promise<PlaceSearchConfirmResponse> {
  await delay(MOCK_LATENCY_MS);

  const found = places.find((place) => place.kakaoPlaceId === kakaoPlaceId);
  if (found === undefined) {
    throw new ApiError(404, 'PLACE_NOT_FOUND', '장소를 찾을 수 없습니다.');
  }

  const seed = findMockPlaceSeed(SEED_PLACE_ID_BY_KAKAO_ID[kakaoPlaceId] ?? -1);

  // 우리 DB에 없는 장소. 카카오에서 온 이름·주소만 있고 핀과 통계는 있을 수 없다.
  if (seed === null) {
    return {
      place: { placeId: null, name: placeName, address: found.address, phone: null },
      pins: [],
      weeklyCrowdStats: [],
    };
  }

  return {
    place: { placeId: seed.placeId, name: seed.name, address: seed.address, phone: seed.phone },
    // 장소 좌표를 함께 넘겨 핀마다 촬영 좌표를 채운다. 지도에 영상핀을 찍는 재료다.
    pins: seed.pins.map((pin, index) => toPinCard(pin, index, seed)),
    weeklyCrowdStats: toWeeklyStats(seed),
  };
}

/**
 * 최근 검색기록 목업.
 *
 * 서버는 (유형, 키워드) 기준으로 중복을 제거해 최신순으로 준다. 두 유형을 섞어 둬서 화면이
 * `PLACE`와 `TAG`를 다르게 다루는지 확인할 수 있게 한다.
 */
const mockRecentSearches: RecentSearch[] = [
  {
    searchId: 3,
    type: 'TAG',
    keyword: '감성',
    placeId: null,
    kakaoPlaceId: null,
    createdAt: new Date(Date.now() - 20 * 60_000).toISOString(),
  },
  {
    // 핀과 통계가 다 있는 장소. 눌러 보면 상세가 꽉 찬 화면으로 이어진다.
    searchId: 2,
    type: 'PLACE',
    keyword: '성수 연무장길',
    placeId: 1,
    kakaoPlaceId: '5234567890',
    createdAt: new Date(Date.now() - 3 * 60 * 60_000).toISOString(),
  },
  {
    // 미등록 장소를 검색한 기록. placeId가 비어 있어도 kakaoPlaceId로 다시 확정할 수 있다.
    searchId: 1,
    type: 'PLACE',
    keyword: '카페 그리다',
    placeId: null,
    kakaoPlaceId: '3234567890',
    createdAt: new Date(Date.now() - 26 * 60 * 60_000).toISOString(),
  },
];

export async function fetchMockRecentSearches(limit?: number): Promise<RecentSearch[]> {
  await delay(MOCK_LATENCY_MS);

  // 생략하면 서버가 20을 쓴다. 목업 기록이 그보다 적으므로 전부 주는 것과 같다.
  if (limit === undefined) return mockRecentSearches;

  if (limit < 1 || limit > RECENT_SEARCH_MAX_LIMIT) {
    throw new ApiError(400, 'INVALID_LIMIT', '조회 개수가 올바르지 않습니다.');
  }

  return mockRecentSearches.slice(0, limit);
}

/** 서버가 한 번에 주는 자동완성 최대 개수(`TagSearchService.MAX_RESULTS`). */
const MAX_TAG_SUGGESTIONS = 10;

/**
 * 태그 자동완성 목업.
 *
 * 서버는 완전일치 → 접두어 → 부분일치 순으로 준다. 목업도 같은 순서를 지켜야 화면에서
 * 순서가 뒤집히는 것을 알아볼 수 있다.
 *
 * 화면에서 확인하는 법: "카페" 또는 "감성"을 입력한다.
 */
export async function searchMockTags(query: string): Promise<TagSuggestion[]> {
  await delay(MOCK_LATENCY_MS);

  if (query.length === 0) {
    throw new ApiError(400, 'INVALID_TAG_NAME', '태그명이 올바르지 않습니다.');
  }

  const tier = (tag: string): number => {
    if (tag === query) return 0;
    return tag.startsWith(query) ? 1 : 2;
  };

  return mockTagVocabulary
    .filter((tag) => tag.includes(query))
    .sort((a, b) => tier(a) - tier(b))
    .slice(0, MAX_TAG_SUGGESTIONS)
    .map((name) => ({ name }));
}

/**
 * 태그 검색 확정 목업.
 *
 * 실제 서버는 **정확히 일치하는** 태그의 핀만 준다. 자동완성과 달리 부분일치를 쓰지 않으므로
 * 어휘에 없는 태그를 고르면 빈 배열이 되고, 결과 없음 화면을 확인할 수 있다.
 *
 * 핀은 여러 장소에서 모으되 같은 식별자는 한 번만 넣는다. 목업 핀은 여섯 시나리오를 돌려
 * 쓰기 때문에(`MOCK_PIN_SCENARIO_COUNT`) 그대로 모으면 같은 핀이 여러 번 들어간다.
 */
export async function fetchMockTaggedPins(tag: string): Promise<TaggedPinsResponse> {
  await delay(MOCK_LATENCY_MS);

  if (tag.length === 0) {
    throw new ApiError(400, 'INVALID_TAG_NAME', '태그명이 올바르지 않습니다.');
  }

  const seen = new Set<string>();
  const pins: PlacePinCardResponse[] = [];

  for (const seed of mockPlaceSeeds) {
    seed.pins.forEach((pin, index) => {
      if (!pin.tags.includes(tag)) return;

      const card = toPinCard(pin, index);
      if (seen.has(card.pinId)) return;

      seen.add(card.pinId);
      pins.push(card);
    });
  }

  // 서버는 최신 작성순으로 준다.
  return { pins: pins.sort((a, b) => b.createdAt.localeCompare(a.createdAt)) };
}

/**
 * 지금 자리의 장소 목업.
 *
 * 서버가 붙었으니 평소에는 쓰이지 않는다(목업 스위치에서 뺐다). 서버 주소가 없는 환경에서
 * 화면 흐름을 확인할 때만 쓴다.
 *
 * 좌표는 실제 API와 시그니처를 맞추기 위해 받기만 한다. 반경 판정과 거리 계산은 서버가 하므로
 * 목업은 고정된 거리를 그대로 준다.
 */
export async function listMockNearbyPlaces(
  _latitude: number,
  _longitude: number,
): Promise<PlaceNearbyItem[]> {
  await delay(MOCK_LATENCY_MS);

  return [...places]
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, 3)
    .map((place) => ({
      kakaoPlaceId: place.kakaoPlaceId,
      placeName: place.name,
      kakaoPlaceLatitude: place.latitude,
      kakaoPlaceLongitude: place.longitude,
      // 카카오 메타는 등록 요청에 실려 가는 값이라 형식만 그럴듯하게 채운다.
      categoryGroupCode: 'CE7',
      categoryGroupName: '카페',
      categoryName: '음식점 > 카페',
      phone: '02-000-0000',
      addressName: place.address,
      distanceMeters: place.distanceMeters,
    }));
}
