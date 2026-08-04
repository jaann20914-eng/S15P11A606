import { createStore } from './createStore';
import type { CrowdFilter } from '@/constants/crowdLevels';
import type { MapBoundsQuery } from '@/types/place';

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
  /**
   * 그 자리에서 당길 축척(카카오 레벨). 생략하면 홈이 장소용 기본값을 쓴다.
   *
   * 영상핀은 장소보다 더 당겨야 한다 — 한 장소의 핀들이 수십 미터 안에 모여 있어 장소용
   * 축척으로는 여러 개가 한 점처럼 겹친다.
   */
  level?: number;
}

/** 지도에 찍는 마커 하나. `components/home/kakaoMapHtml`의 `MapPlaceMarker`와 같은 모양이다. */
export interface MapMarker {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

/**
 * 상세 화면이 홈 지도에 대신 찍어 달라고 넘긴 영상핀.
 *
 * 상세 화면은 **자기 지도가 없다.** 반투명 모달로 홈 위에 겹쳐 있어 아래 홈 지도가 그대로
 * 보이므로, 마커를 바꾸려면 홈에게 부탁해야 한다(내 위치 버튼이 `focusOn`으로 같은 일을 한다).
 *
 * `markers`가 있는 동안 홈은 장소 마커 대신 이것을 찍는다. 상세를 닫으면 비워 장소 마커로
 * 돌아간다.
 */
export interface PinMarkerOverlay {
  markers: MapMarker[];
  /** 지금 보고 있는 게시물의 핀. 마커 모양(동그라미/뾰족한 핀)이 이 값으로 갈린다. */
  selectedPinId: string | null;
}

/**
 * 손가락으로 지도를 직접 다루는 손잡이. 홈이 지도가 준비되면 여기에 등록한다.
 *
 * **저장소는 지도 컴포넌트를 알지 않는다.** 그래서 타입을 여기에 다시 적는다 —
 * `components/home`의 `MapGestureControl`이 이 모양이고, `KakaoMapHandle`이 그것을 갖는다.
 * 저장소가 컴포넌트를 import하면 컴포넌트가 저장소의 `Coordinate`를 쓰는 것과 맞물려 순환이 된다.
 */
export interface MapGestureControl {
  dragBy: (dx: number, dy: number) => void;
  dragEnd: () => void;
  zoomBy: (step: number) => void;
}

export interface MapState {
  center: Coordinate;
  bounds: MapBounds | null;
  /** 상세 화면이 넘긴 영상핀 마커. null이면 홈이 장소 마커를 찍는다. */
  pinOverlay: PinMarkerOverlay | null;
  /**
   * 홈 시트가 놓이는 영역의 높이. 홈이 직접 재서 올린다. 아직 재지 못했으면 0.
   *
   * **위에 겹치는 장소 상세가 자기 시트를 같은 자리에 놓으려고 쓴다.** 두 시트는 3단계 높이를
   * 같은 식으로 계산하는데, 기준이 되는 영역이 서로 달랐다 — 홈은 탭바가 레이아웃을 차지해
   * `onLayout`으로 잰 값이고, 상세는 탭 그룹 밖이라 창 높이를 쓴다. 그 둘은 실기기에서 같지
   * 않아서, 같은 식으로 계산해도 상세 시트가 홈보다 눈에 띄게 높았다.
   *
   * 재는 쪽 값을 그대로 나눠 쓰면 어긋날 여지가 없다. 계산으로 맞추려면 탭바·시스템 내비게이션
   * 높이를 두 화면이 각자 더하고 빼야 하고, 한쪽만 바뀌면 조용히 틀린다.
   */
  homeSheetSpace: number;
  /**
   * 지금 화면에 있는 지도를 손으로 다루는 손잡이. 지도가 없으면 null.
   *
   * 홈이 지도를 만들고 준비되면 등록한다. 지도를 갖지 않은 화면(장소 상세)은 이것으로 아래 깔린
   * 홈 지도를 끌고 당긴다 — 그 화면에서는 손가락이 WebView까지 닿지 않기 때문이다.
   */
  gestureControl: MapGestureControl | null;
  /** 처리되기를 기다리는 이동 요청. 없으면 null. */
  focus: MapFocus | null;
  /** 상단 혼잡도 필터. 지도 핀 색 계열과 목록 필터링을 함께 결정한다. */
  crowdFilter: CrowdFilter;
  selectedPlaceId: string | null;
  setCenter: (center: Coordinate) => void;
  setBounds: (bounds: MapBounds | null) => void;
  /** 검색 화면에서 장소를 골랐을 때. 홈이 처리하고 `clearFocus`로 비운다. */
  focusOn: (focus: MapFocus) => void;
  clearFocus: () => void;
  setCrowdFilter: (crowdFilter: CrowdFilter) => void;
  toggleCrowdFilter: () => void;
  selectPlace: (placeId: string | null) => void;
  /** 상세 화면이 자기 영상핀을 지도에 올린다. 닫을 때 `clearPinOverlay`로 반드시 되돌린다. */
  showPinOverlay: (overlay: PinMarkerOverlay) => void;
  clearPinOverlay: () => void;
  /** 홈이 시트 영역을 재서 올린다. 상세 시트가 같은 기준으로 높이를 잡는다. */
  setHomeSheetSpace: (space: number) => void;
  /** 지도를 가진 화면이 자기 손잡이를 등록한다. 화면을 떠날 때 `null`로 되돌린다. */
  setGestureControl: (control: MapGestureControl | null) => void;
}

export const useMapStore = createStore<MapState>((set, get) => ({
  center: DEFAULT_CENTER,
  bounds: null,
  pinOverlay: null,
  homeSheetSpace: 0,
  gestureControl: null,
  focus: null,
  crowdFilter: 'relaxed',
  selectedPlaceId: null,
  setCenter: (center) => set({ center }),
  setBounds: (bounds) => set({ bounds }),
  focusOn: (focus) => set({ focus }),
  clearFocus: () => set({ focus: null }),
  setCrowdFilter: (crowdFilter) => set({ crowdFilter }),
  toggleCrowdFilter: () => set({ crowdFilter: get().crowdFilter === 'relaxed' ? 'wagle' : 'relaxed' }),
  selectPlace: (selectedPlaceId) => set({ selectedPlaceId }),
  showPinOverlay: (pinOverlay) => set({ pinOverlay }),
  clearPinOverlay: () => set({ pinOverlay: null }),
  setHomeSheetSpace: (homeSheetSpace) => set({ homeSheetSpace }),
  setGestureControl: (gestureControl) => set({ gestureControl }),
}));

/**
 * 지도 경계를 서버가 받는 쿼리 모양으로 편다.
 *
 * 장소 목록과 태그 검색이 모두 이 네 값을 평평하게 받는다. 화면마다 손으로 풀어 쓰면 위도와
 * 경도를 바꿔 넣어도 컴파일에서 걸리지 않아(둘 다 number) 조용히 빈 결과가 된다.
 */
export function toBoundsQuery({ southWest, northEast }: MapBounds): MapBoundsQuery {
  return {
    southWestLatitude: southWest.latitude,
    southWestLongitude: southWest.longitude,
    northEastLatitude: northEast.latitude,
    northEastLongitude: northEast.longitude,
  };
}

/** bounds를 `/places` 쿼리 문자열 형식으로 변환한다. */
export function serializeBounds(bounds: MapBounds): string {
  const { southWest, northEast } = bounds;
  return [southWest.latitude, southWest.longitude, northEast.latitude, northEast.longitude].join(',');
}
