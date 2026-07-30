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
