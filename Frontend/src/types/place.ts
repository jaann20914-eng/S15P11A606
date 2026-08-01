// 백엔드 /api/v1/places 응답에 맞춘 도메인 타입.
import type { PlaceCategory } from '@/constants/categories';
import type { CrowdFilter } from '@/constants/crowdLevels';
import type { PinId } from './pin';

export type Place = {
  /** 서버 식별자. DB가 BIGINT라 숫자로 다룬다. */
  id: number;
  name: string;
  address: string;
  category: PlaceCategory;
  latitude: number;
  longitude: number;
};

/* ------------------------------------------------------------------ *
 * GET /api/v1/places — 지도 범위 내 장소·활성핀 목록
 * ------------------------------------------------------------------ */

/** 평균 혼잡도 표시 구간. 집계 가능한 핀이 없으면 서버가 null을 준다. */
export type PlaceCrowdLabel = 'WAGLE' | 'RELAXED';

/** 장소에 붙은 활성 핀. 최근 1시간 이내 것만 온다. */
export interface PlaceActivePin {
  pinId: PinId;
  latitude: number;
  longitude: number;
  /** 작성자의 공개 뷰 각도. */
  viewAngle: number;
}

/** 목록 한 건. 지도 마커와 목록 카드가 이 값을 함께 쓴다. */
export interface PlaceListItem {
  placeId: number;
  name: string;
  address: string;
  /** 없거나 확인할 수 없으면 null. */
  phone: string | null;
  latitude: number;
  longitude: number;
  /** 최근 1시간 유효 핀의 평균 혼잡 단계(1~4, 소수 첫째 자리). 집계할 핀이 없으면 null. */
  averageCrowdLevel: number | null;
  crowdLabel: PlaceCrowdLabel | null;
  /** 활성 핀이 없으면 빈 배열. */
  activePins: PlaceActivePin[];
}

/** `GET /api/v1/places` 응답의 `data`. */
export interface PlacesResponse {
  places: PlaceListItem[];
}

/**
 * 조회 조건.
 *
 * 지도 경계 네 값은 함께 보내야 한다. 남서 좌표가 북동 좌표보다 작아야 하며, 어기면
 * `INVALID_MAP_RANGE`가 온다.
 */
export interface PlacesQuery {
  southWestLatitude: number;
  southWestLongitude: number;
  northEastLatitude: number;
  northEastLongitude: number;
  /** 생략하면 혼잡도와 관계없이 조회한다. */
  filter?: CrowdFilter;
}

/* ------------------------------------------------------------------ *
 * GET /api/v1/places/{placeId} — 장소 상세
 * ------------------------------------------------------------------ */

/**
 * 상세의 장소 기본 정보.
 *
 * **좌표가 없다.** 지도에 이 장소를 찍으려면 목록(`GET /api/v1/places`)에서 받아야 한다.
 * `api/place/coordinates.ts`가 그 일을 맡는다.
 */
export interface PlaceSummary {
  placeId: number;
  name: string;
  address: string;
  phone: string | null;
}

/** 상세의 핀 카드 한 장. */
export interface PlacePinCard {
  pinId: PinId;
  nickname: string;
  /** 작성자의 공개 뷰 각도. */
  viewAngle: number;
  /** ISO 8601. */
  createdAt: string;
  memo: string;
  /** 썸네일 주소. 받지 못했으면 null이고 화면은 자리만 비워 둔다. */
  thumbnailUrl: string | null;
  /** 없으면 빈 배열. */
  tags: string[];
  /** 내가 이미 열람한 핀인지. 썸네일 블러 여부를 가른다. */
  isUnlocked: boolean;
}

/**
 * 서버가 준 핀 카드 원형.
 *
 * 명세의 JSON 예시는 `thumbnailKey`, 필드 표는 `videoThumbnailUrl`로 적혀 있어 어느 쪽이
 * 올지 확정되지 않았다. 둘 다 선택으로 받아 두고 API 경계에서 `thumbnailUrl` 하나로 모은다.
 * 확정되면 여기 한 곳만 지우면 된다.
 */
export type PlacePinCardResponse = Omit<PlacePinCard, 'thumbnailUrl'> & {
  videoThumbnailUrl?: string | null;
  thumbnailKey?: string | null;
};

export type DayOfWeek = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';

/** 요일별 평균 혼잡 단계. 집계 데이터가 없는 요일은 null이다. */
export interface DayCrowdStat {
  dayOfWeek: DayOfWeek;
  averageCrowdLevel: number | null;
}

/** `GET /api/v1/places/{placeId}` 응답의 `data` 원형. */
export interface PlaceDetailResponse {
  place: PlaceSummary;
  pins: PlacePinCardResponse[];
  /** 전체 요일에 집계가 없으면 빈 배열이다. */
  weeklyCrowdStats: DayCrowdStat[];
}

/** 화면이 쓰는 장소 상세. 핀 카드의 썸네일 필드만 정리된 모양이다. */
export interface PlaceDetail extends Omit<PlaceDetailResponse, 'pins'> {
  pins: PlacePinCard[];
}

/** 월요일부터의 요일 순서. 통계가 비어 있어도 일곱 칸을 그리려면 이 순서가 필요하다. */
export const DAYS_OF_WEEK: readonly DayOfWeek[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

/** 요일 칩에 쓰는 한글 라벨. */
export const dayOfWeekLabel: Record<DayOfWeek, string> = {
  MON: '월',
  TUE: '화',
  WED: '수',
  THU: '목',
  FRI: '금',
  SAT: '토',
  SUN: '일',
};

/**
 * 장소 검색 결과 항목.
 *
 * 카카오 Local API가 준 외부 장소다. 내부 `Place.id`와 구분해 `kakaoPlaceId`(문자열)로
 * 식별한다. 핀을 등록하는 시점에 서버가 내부 장소로 연결한다.
 */
export interface PlaceSearchItem {
  kakaoPlaceId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  /** 사용자 좌표와의 거리. 서버가 이 값 오름차순으로 정렬해 준다. */
  distanceMeters: number;
}

/** `GET /api/v1/places/search` 응답의 `data`. */
export interface PlaceSearchResponse {
  places: PlaceSearchItem[];
}

/**
 * 검색어 최소 길이. 이보다 짧으면 요청을 보내지 않는다.
 *
 * 서버가 빈 검색어를 400으로 막고, 한 글자로는 결과가 너무 넓어 호출할 가치가 없다.
 */
export const MIN_PLACE_QUERY_LENGTH = 2;

/** 입력이 멈춘 뒤 요청을 보내기까지 기다리는 시간. 글자마다 호출되는 것을 막는다. */
export const PLACE_SEARCH_DEBOUNCE_MS = 700;

/**
 * 홈 검색바가 쓰는 반경(m). 카카오 Local이 허용하는 최댓값이다.
 *
 * 서버 기본값은 50m인데(`PlaceService.DEFAULT_SEARCH_RADIUS_METERS`), 그건 **핀을 등록할 때
 * "지금 서 있는 장소"를 고르는 용도**다. 검색바는 성격이 정반대라 — 지금 있는 곳이 아니라
 * 가려는 곳을 찾는다 — 50m로 두면 대부분의 검색이 빈 결과가 된다.
 *
 * 서버는 `radius`를 선택 파라미터로 받으므로 화면이 용도에 맞게 정한다.
 */
export const WIDE_PLACE_SEARCH_RADIUS_M = 20_000;

/** `usePlaceSearch` 동작 조정. 화면의 용도에 따라 달라지는 것만 둔다. */
export interface PlaceSearchOptions {
  /** 생략하면 서버 기본값(50m). 넓게 찾아야 하는 화면은 직접 정한다. */
  radius?: number;
  /**
   * 기기 위치를 얻지 못했을 때 대신 쓸 좌표.
   *
   * 서버가 `latitude`·`longitude`를 필수로 받아, 좌표가 없으면 검색을 아예 못 한다.
   * 하지만 검색바는 "가려는 곳"을 찾는 곳이라 내 위치를 몰라도 성립한다 — 지도 중심을
   * 넘겨 주면 권한을 거부한 사용자도 검색할 수 있다.
   *
   * 핀 등록은 반대다. 지금 서 있는 자리를 골라야 하므로 대체 좌표를 주지 않는다.
   */
  fallbackCoordinate?: { latitude: number; longitude: number };
}
