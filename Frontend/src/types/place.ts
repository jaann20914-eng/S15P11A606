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
  /**
   * 생략하면 혼잡도와 관계없이 조회한다.
   *
   * **서버에서는 필수 파라미터다.** 여기서 선택인 것은 호출부 편의이고, 빈 값을 채워 보내는
   * 일은 `api/place/list.ts`가 맡는다(`NO_FILTER`). 값을 지정하면 평균 혼잡도가 없는 장소
   * — 활성 핀이 없는 장소 — 가 응답에서 빠진다.
   */
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
  /**
   * 공개 메모. **없을 수 있다.**
   *
   * 핀을 등록할 때 메모는 선택이고(요구사항 VIDPIN-04) DB 열도 nullable이라(`Pin.memo`)
   * 서버가 `null`을 준다. 목업은 늘 채워서 주기 때문에 목업만 보면 드러나지 않는다.
   */
  memo: string | null;
  /** 썸네일 주소. 받지 못했으면 null이고 화면은 자리만 비워 둔다. */
  thumbnailUrl: string | null;
  /** 없으면 빈 배열. */
  tags: string[];
  /** 내가 크레딧으로 열람한 핀인지. 서버가 결제 기록만 보고 정한다. */
  isUnlocked: boolean;
  /**
   * 썸네일을 선명하게 보여줘도 되는지. **아니면 블러로 가린다.**
   *
   * 현장 영상은 크레딧을 써야 볼 수 있고, 썸네일은 그 영상의 한 장면이라 **같은 기준으로
   * 가려야 한다**(`revealsVideo`). 안 가리면 목록을 훑는 것만으로 현장이 보여 결제 흐름이
   * 통째로 무의미해진다.
   *
   * 카드 응답만으로는 판정할 수 없다. `isUnlocked`는 결제 기록이라 **작성자 본인도 false**이고
   * (`PinCardAssembler`), 서버 카드에는 작성자 여부가 없다. 그래서 첫 값은 `isUnlocked`를 쓰고,
   * 썸네일을 받아 오는 쪽이 핀 상세의 접근 수준(`videoAccess`)으로 고쳐 준다
   * (`features/place-detail/hooks/usePinThumbnails.ts`). **모를 때는 가리는 쪽**이 기본이다.
   */
  revealed: boolean;
  /**
   * 촬영 좌표. **서버는 아직 주지 않아 실서버에서는 null이다**(백엔드에 요청해 둔 항목).
   *
   * 있으면 상세 화면이 그 자리에 영상핀 마커를 찍고, 게시물을 오르내릴 때 지도를 그 좌표로
   * 옮긴다. 없으면 마커를 찍지 않고 지도는 장소 좌표에 머문다 — 화면이 깨지지 않아야 한다.
   */
  latitude: number | null;
  longitude: number | null;
}

/**
 * 서버가 준 핀 카드 원형.
 *
 * 명세의 JSON 예시는 `thumbnailKey`, 필드 표는 `videoThumbnailUrl`로 적혀 있어 어느 쪽이
 * 올지 확정되지 않았다. 둘 다 선택으로 받아 두고 API 경계에서 `thumbnailUrl` 하나로 모은다.
 * 확정되면 여기 한 곳만 지우면 된다.
 *
 * `revealed`도 없다. 서버 카드에는 작성자 여부가 없어 화면이 따로 정한다(위 설명 참고).
 */
export type PlacePinCardResponse = Omit<
  PlacePinCard,
  'thumbnailUrl' | 'latitude' | 'longitude' | 'revealed'
> & {
  videoThumbnailUrl?: string | null;
  thumbnailKey?: string | null;
  /** 서버가 아직 주지 않는다. 목업은 채워 주므로 선택으로 받아 둔다. */
  latitude?: number | null;
  longitude?: number | null;
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

/* ------------------------------------------------------------------ *
 * POST /api/v1/places/search/{kakaoPlaceId} — 장소 검색 확정
 * ------------------------------------------------------------------ */

/**
 * 확정된 장소의 기본 정보.
 *
 * 상세(`PlaceSummary`)와 한 가지가 다르다. **`placeId`가 `null`일 수 있다.** 우리 DB에 없는
 * 카카오 장소를 고르면 서버가 이름·주소·연락처만 카카오에서 실시간으로 채우고 식별자는
 * 비운다 — 아직 아무도 핀을 남기지 않은 장소다. 오류가 아니라 정상 응답(200)이다.
 */
export type ConfirmedPlaceSummary = Omit<PlaceSummary, 'placeId'> & {
  placeId: number | null;
};

/**
 * `POST /api/v1/places/search/{kakaoPlaceId}` 응답의 `data` 원형.
 *
 * 상세와 같은 모양을 준다. 그래서 검색으로 들어오든 지도에서 들어오든 화면 하나로 받는다.
 * 미등록 장소면 `pins`와 `weeklyCrowdStats`는 빈 배열이다.
 */
export interface PlaceSearchConfirmResponse extends Omit<PlaceDetailResponse, 'place'> {
  place: ConfirmedPlaceSummary;
}

/** 화면이 쓰는 검색 확정 결과. 상세와 마찬가지로 썸네일 필드만 정리된 모양이다. */
export interface PlaceSearchConfirmResult extends Omit<PlaceSearchConfirmResponse, 'pins'> {
  pins: PlacePinCard[];
}

/* ------------------------------------------------------------------ *
 * GET /api/v1/places/search/recent — 최근 검색기록
 * ------------------------------------------------------------------ */

/**
 * 검색기록 유형.
 *
 * 명세 문서에는 `KEYWORD`도 적혀 있으나 서버 `SearchType` enum은 이 둘뿐이다.
 */
export type RecentSearchType = 'PLACE' | 'TAG';

/**
 * 최근 검색기록 한 건.
 *
 * `type`이 재실행 경로를 가른다 — `PLACE`면 `kakaoPlaceId`로 장소 확정을, `TAG`면 `keyword`로
 * 태그 확정을 다시 부른다.
 *
 * 기록을 남기는 일은 프론트가 하지 않는다. 두 확정 API가 각각 서버에서 저장하므로 등록
 * API는 없다. 개별·전체 삭제 API도 아직 없다.
 */
export interface RecentSearch {
  searchId: number;
  type: RecentSearchType;
  keyword: string;
  /** `TAG`이거나, 우리 DB에 없는 장소를 골랐으면 null이다. */
  placeId: number | null;
  /** `TAG`이면 null이다. */
  kakaoPlaceId: string | null;
  /** ISO 8601 UTC. 표시할 때 현지 시각으로 바꾼다. */
  createdAt: string;
}

/**
 * 최근 검색기록 조회 개수의 서버 허용 범위(`RecentSearchService`).
 * 벗어나면 `INVALID_LIMIT`으로 400이 온다. 생략하면 서버가 20을 쓴다.
 */
export const RECENT_SEARCH_MAX_LIMIT = 50;

/* ------------------------------------------------------------------ *
 * GET · POST /api/v1/pins/tags/search — 태그 검색
 * ------------------------------------------------------------------ */

/**
 * 지도 경계만 담은 조회 조건.
 *
 * 태그 검색 두 API가 장소 목록과 똑같은 네 값을 요구한다. 따로 적으면 한쪽만 고쳐질 수
 * 있으므로 목록 조건에서 필터만 뺀 모양으로 둔다.
 */
export type MapBoundsQuery = Omit<PlacesQuery, 'filter'>;

/**
 * 태그 자동완성 한 건.
 *
 * 서버가 지도 경계 안의 활성·미만료 핀에 달린 태그만 후보로 삼고, 완전일치 → 접두어 →
 * 부분일치 순으로 최대 10개를 준다. 그래서 결과가 없는 태그는 제안되지 않는다.
 */
export interface TagSuggestion {
  name: string;
}

/** `GET /api/v1/pins/tags/search` 응답의 `data`. */
export interface TagSearchResponse {
  tags: TagSuggestion[];
}

/**
 * `POST /api/v1/pins/tags/search` 응답의 `data` 원형.
 *
 * 핀 카드가 장소 상세와 **같은 모양**이다(서버도 같은 레코드를 재사용한다). 태그 검색이
 * `/pins` 경로인데 타입이 이 파일에 있는 이유가 그것이다 — 카드 타입을 여기서 소유하고
 * 있어 옮기면 파일 사이가 서로를 참조하게 된다.
 */
export interface TaggedPinsResponse {
  pins: PlacePinCardResponse[];
}

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

/**
 * 지금 서 있는 자리의 장소 후보 — `GET /api/v1/places/nearby`
 *
 * 검색 결과(`PlaceSearchItem`)와 값의 성격이 다르다. 이쪽은 **핀 등록 요청에 실어 보낼 값을
 * 그대로** 준다 — 카카오 식별자와 이름·좌표뿐 아니라 카테고리·전화·지번 주소까지 온다.
 * 서버가 그 장소를 처음 저장할 때 쓰는 값이라, 프론트는 고른 것을 그대로 들고 있다가 등록에
 * 넘기기만 한다.
 *
 * 그래서 필드 이름도 검색 결과와 다르다(`placeName`·`kakaoPlaceLatitude`). 등록 요청의 이름과
 * 같게 맞춰 둔 것이므로 화면 편의로 바꾸지 않는다 — 옮겨 담는 자리가 늘면 한쪽만 고치는 일이
 * 생긴다.
 *
 * 반경 50m 안만 오고 거리 오름차순이다. 그 반경이 곧 등록 가능 범위다(촬영 좌표도 그 안이어야
 * 한다).
 */
export interface PlaceNearbyItem {
  kakaoPlaceId: string;
  placeName: string;
  kakaoPlaceLatitude: number;
  kakaoPlaceLongitude: number;
  /** 카카오 카테고리 분류. 없는 장소도 있어 빈 문자열이 올 수 있다. */
  categoryGroupCode: string;
  categoryGroupName: string;
  categoryName: string;
  phone: string;
  /** 지번 주소(카카오 `address_name`). */
  addressName: string;
  distanceMeters: number;
}

/** `GET /api/v1/places/nearby` 응답의 `data`. */
export interface PlaceNearbyResponse {
  places: PlaceNearbyItem[];
}
