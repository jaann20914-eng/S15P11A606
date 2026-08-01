// 백엔드 /api/v1/places 응답에 맞춘 도메인 타입. 연동 전이라 아직 참조하는 화면이 없다.
import type { PlaceCategory } from '@/constants/categories';

export type Place = {
  /** 서버 식별자. DB가 BIGINT라 숫자로 다룬다. */
  id: number;
  name: string;
  address: string;
  category: PlaceCategory;
  latitude: number;
  longitude: number;
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
