import { createStore } from './createStore';
import type { CrowdFilter } from '@/constants/crowdLevels';

export interface Coordinate {
  latitude: number;
  longitude: number;
}

/** 지도 화면 범위. `/places` 의 bounds 쿼리(swLat,swLng,neLat,neLng)로 직렬화된다. */
export interface MapBounds {
  southWest: Coordinate;
  northEast: Coordinate;
}

/** 서울숲 일대 — 지도 최초 중심이자 위치 권한 연동 전 "내 위치" 목업 좌표 */
export const DEFAULT_CENTER: Coordinate = { latitude: 37.5445, longitude: 127.0374 };

/**
 * 검색 화면이 고른 장소. 홈 지도가 이 좌표로 이동한 뒤 비운다.
 *
 * 검색 결과는 카카오 장소라 우리 `placeId`가 없다(`/places/search`는 `kakaoPlaceId`만 준다).
 * 상세 화면으로 보낼 수 없으므로, 지도를 그 자리로 옮겨 주는 것이 지금 할 수 있는 연결이다.
 */
export interface MapFocus {
  coordinate: Coordinate;
  /** 이동한 뒤 무엇을 찾아갔는지 알려주는 데 쓴다. */
  name: string;
}

export interface MapState {
  center: Coordinate;
  bounds: MapBounds | null;
  /**
   * 지도 확대 레벨(카카오 기준 1~14, 작을수록 확대). 지도가 한 번도 멈추지 않았으면 null.
   *
   * 축척 막대가 가리키는 거리와 짝을 이룬다 — `PLACE_FOCUS_MAP_LEVEL`의 표를 참고한다.
   * 목록에서 고른 장소를 얼마나 가까이 보고 있는지 판정하는 데 쓴다.
   */
  mapLevel: number | null;
  /** 처리되기를 기다리는 이동 요청. 없으면 null. */
  focus: MapFocus | null;
  /** 상단 혼잡도 필터. 지도 핀 색 계열과 목록 필터링을 함께 결정한다. */
  crowdFilter: CrowdFilter;
  selectedPlaceId: string | null;
  setCenter: (center: Coordinate) => void;
  setBounds: (bounds: MapBounds | null) => void;
  setMapLevel: (mapLevel: number) => void;
  /** 검색 화면에서 장소를 골랐을 때. 홈이 처리하고 `clearFocus`로 비운다. */
  focusOn: (focus: MapFocus) => void;
  clearFocus: () => void;
  setCrowdFilter: (crowdFilter: CrowdFilter) => void;
  toggleCrowdFilter: () => void;
  selectPlace: (placeId: string | null) => void;
}

export const useMapStore = createStore<MapState>((set, get) => ({
  center: DEFAULT_CENTER,
  bounds: null,
  mapLevel: null,
  focus: null,
  crowdFilter: 'relaxed',
  selectedPlaceId: null,
  setCenter: (center) => set({ center }),
  setBounds: (bounds) => set({ bounds }),
  setMapLevel: (mapLevel) => set({ mapLevel }),
  focusOn: (focus) => set({ focus }),
  clearFocus: () => set({ focus: null }),
  setCrowdFilter: (crowdFilter) => set({ crowdFilter }),
  toggleCrowdFilter: () => set({ crowdFilter: get().crowdFilter === 'relaxed' ? 'wagle' : 'relaxed' }),
  selectPlace: (selectedPlaceId) => set({ selectedPlaceId }),
}));

/**
 * 좌표가 지금 보고 있는 지도 사각형 안에 있는지.
 *
 * 목록에서 고른 장소가 화면에 들어와 있는지 판정하는 데 쓴다. 경계는 지도가 멈출 때 갱신되므로
 * 손으로 옮기는 도중에는 한 박자 뒤처진 값으로 판정할 수 있다. 그래도 한 번 더 누르면 맞는
 * 값으로 다시 판정되므로 막히지는 않는다.
 */
export function isWithinBounds(bounds: MapBounds, coordinate: Coordinate): boolean {
  const { southWest, northEast } = bounds;

  return (
    coordinate.latitude >= southWest.latitude &&
    coordinate.latitude <= northEast.latitude &&
    coordinate.longitude >= southWest.longitude &&
    coordinate.longitude <= northEast.longitude
  );
}

/** bounds를 `/places` 쿼리 문자열 형식으로 변환한다. */
export function serializeBounds(bounds: MapBounds): string {
  const { southWest, northEast } = bounds;
  return [southWest.latitude, southWest.longitude, northEast.latitude, northEast.longitude].join(',');
}
