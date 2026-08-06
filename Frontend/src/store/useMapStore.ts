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
   * 핀은 장소보다 더 당겨야 한다 — 한 장소의 핀들이 수십 미터 안에 모여 있어 장소용
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
  /**
   * 색 계열. **그 장소·핀이 실제로 붐비는 정도**이지 상단 토글이 아니다.
   *
   * 생략하면 지도가 토글 값으로 칠한다(옛 동작). 이유는 `MapPlaceMarker.tone`에 적어 두었다.
   */
  tone?: CrowdFilter;
  /** 처음부터 작은 마커로 그릴지. 이유는 `MapPlaceMarker.small`에 적어 두었다. */
  small?: boolean;
}

/**
 * 상세 화면이 홈 지도에 대신 찍어 달라고 넘긴 핀.
 *
 * 상세 화면은 **자기 지도가 없다.** 반투명 모달로 홈 위에 겹쳐 있어 아래 홈 지도가 그대로
 * 보이므로, 마커를 바꾸려면 홈에게 부탁해야 한다(내 위치 버튼이 `focusOn`으로 같은 일을 한다).
 *
 * `markers`가 있는 동안 홈은 장소 마커 대신 이것을 찍는다. 상세를 닫으면 비워 장소 마커로
 * 돌아간다.
 */
export interface PinMarkerOverlay {
  markers: MapMarker[];
  /**
   * 지금 보고 있는 게시물의 핀. 마커 모양(동그라미/뾰족한 핀)이 이 값으로 갈린다.
   *
   * **한 방향이다 — 상세 화면이 쓰고 지도가 읽는다.** 지도에서 마커를 누른 것은 이 값을 고쳐
   * 알리지 않고 `pressedPinId`로 따로 온다. 두 쪽이 같은 칸을 쓰면 서로의 **한 커밋 지난 값**을
   * 보고 되돌리기를 주고받아 끝나지 않는다(그 사정은 `pressedPinId`에 적어 두었다).
   */
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
  /** 화면의 그 점을 탭한 것으로 다룬다. 마커 판정은 지도가 한다. */
  tapAt: (x: number, y: number) => void;
}

export interface MapState {
  center: Coordinate;
  bounds: MapBounds | null;
  /**
   * 지금 지도 축척(카카오 레벨). 작을수록 당겨진 상태다.
   *
   * 홈이 지도가 멈출 때마다 올린다. **지도를 갖지 않은 화면도 이 값을 봐야 한다** — 20m에서만
   * 있는 컨트롤(옆 장소 버튼)이 장소 상세 위에 뜨는데, 그 화면은 축척을 알 길이 없다.
   *
   * 초기값은 `components/home/kakaoMapHtml`의 `DEFAULT_MAP_LEVEL`과 같은 값이다. 저장소가
   * 컴포넌트를 import하면 순환이 되므로 여기에 다시 적는다(`MapGestureControl`과 같은 사정이다).
   */
  mapLevel: number;
  /** 상세 화면이 넘긴 핀 마커. null이면 홈이 장소 마커를 찍는다. */
  pinOverlay: PinMarkerOverlay | null;
  /**
   * **20m까지 당긴 그 순간 화면에 있던, 핀이 올라온 장소들.** 사용자에게 가까운 순이다.
   *
   * 그 축척에서는 장소 하나를 들여다보는 것이 자연스러워, 당기는 순간 가장 가까운 장소의 상세가
   * 열린다. 그런데 화면에 여러 곳이 담겨 있으면 **사용자가 노린 곳이 아닐 수 있다** — "여기가
   * 아니라 옆 장소를 보고 싶다"를 위해 다음 장소로 돌려 보는 버튼이 이 목록을 쓴다.
   *
   * **당기는 순간에 정하고 그대로 둔다.** 돌려 볼 때마다 지도가 그 장소로 옮겨지므로, 화면에
   * 담긴 곳을 매번 다시 구하면 방금 지나온 장소가 목록에서 빠져 한 바퀴를 돌 수 없다.
   *
   * 축척이 30m 이상으로 넓어지면 비운다. 비어 있거나 한 곳뿐이면 돌려 볼 것이 없어 버튼도 없다.
   */
  nearbyPlaces: MapMarker[];
  /**
   * 지도에서 방금 눌린 핀. **한 번 쓰고 비우는 요청이다**(상태 거울이 아니다).
   *
   * 지도는 홈 것이라 마커 눌림도 홈으로 온다. 그것을 상세 화면에 알릴 길이 필요한데, 예전에는
   * `pinOverlay.selectedPinId`를 홈이 고쳐서 알렸다. 그러면 **같은 칸을 두 쪽이 쓴다** —
   * 상세는 "보고 있는 카드"를 그 칸에 쓰고, 홈은 "눌린 마커"를 같은 칸에 쓴다.
   *
   * 저장소 값은 **한 커밋 늦게** 화면에 들어오므로(리렌더로 온다), 두 쪽의 값이 어긋난 순간
   * 서로 상대의 낡은 값을 보고 자기 것으로 되돌린다. 카드가 두 번호 사이를 튀며 지도 이동
   * 요청이 끝없이 나가 홈에서 렌더가 끊겼다(2026-08-05 실기기: `1/3`과 `2/3`이 수십 번).
   *
   * 그래서 눌림은 **따로, 한 번만** 알린다. 받은 화면이 곧바로 비우므로 되돌릴 값이 남지 않는다.
   */
  pressedPinId: string | null;
  /**
   * **다음 홈 복귀에서 축척을 건드리지 말라는 일회성 요청.** 탭바의 홈 버튼이 올린다.
   *
   * 홈에는 "상세가 닫히면 250m로 넓힌다"는 규칙이 있는데, 그 표시(`hadPinOverlay`)는 홈이
   * 늦게 돌아와도 남아 있다. 그래서 상세를 거쳐 다른 탭을 돌다 **탭바 홈 버튼**으로 돌아오면
   * 그 순간 축척이 강제로 넓어졌다 — 가려져 있던 지도의 주변 타일이 없어 보던 범위만 섬처럼
   * 남았다(2026-08-06 실기기). 버튼으로 돌아온 홈은 보던 축척 그대로가 맞다. 뒤로 가기로
   * 상세를 직접 닫는 길은 이 요청이 없으므로 기존대로 넓힌다.
   *
   * `pressedPinId`와 같은 한 번 쓰고 비우는 요청이다 — 홈이 복귀하며 소비한다.
   */
  keepMapLevelOnce: boolean;
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
  /** 지도가 멈출 때마다 홈이 축척을 올린다. */
  setMapLevel: (level: number) => void;
  /** 검색 화면에서 장소를 골랐을 때. 홈이 처리하고 `clearFocus`로 비운다. */
  focusOn: (focus: MapFocus) => void;
  clearFocus: () => void;
  setCrowdFilter: (crowdFilter: CrowdFilter) => void;
  toggleCrowdFilter: () => void;
  selectPlace: (placeId: string | null) => void;
  /** 상세 화면이 자기 핀을 지도에 올린다. 닫을 때 `clearPinOverlay`로 반드시 되돌린다. */
  showPinOverlay: (overlay: PinMarkerOverlay) => void;
  clearPinOverlay: () => void;
  /** 지도에서 핀 마커가 눌렸다고 알린다. 받는 화면이 처리하고 `clearPressedPin`으로 비운다. */
  pressPin: (pinId: string) => void;
  clearPressedPin: () => void;
  /** 탭바 홈 버튼이 "이번 복귀는 축척 그대로"를 올린다. 홈이 복귀하며 소비한다. */
  requestKeepMapLevel: () => void;
  consumeKeepMapLevel: () => boolean;
  /** 20m에서 돌려 볼 장소를 정한다. 그 축척을 벗어나면 빈 배열로 비운다(홈이 맡는다). */
  setNearbyPlaces: (places: MapMarker[]) => void;
  /** 홈이 시트 영역을 재서 올린다. 상세 시트가 같은 기준으로 높이를 잡는다. */
  setHomeSheetSpace: (space: number) => void;
  /** 지도를 가진 화면이 자기 손잡이를 등록한다. 화면을 떠날 때 `null`로 되돌린다. */
  setGestureControl: (control: MapGestureControl | null) => void;
}

/** 돌려 볼 장소가 없을 때 쓰는 빈 목록. 참조가 고정이라 헛된 리렌더가 없다. */
const NO_NEARBY_PLACES: MapMarker[] = [];

export const useMapStore = createStore<MapState>((set, get) => ({
  center: DEFAULT_CENTER,
  bounds: null,
  mapLevel: 5,
  pinOverlay: null,
  pressedPinId: null,
  keepMapLevelOnce: false,
  nearbyPlaces: NO_NEARBY_PLACES,
  homeSheetSpace: 0,
  gestureControl: null,
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
  showPinOverlay: (pinOverlay) => set({ pinOverlay }),
  // 겹을 걷을 때 눌림 요청도 함께 버린다. 남겨 두면 다음 화면이 남의 요청을 처리한다.
  clearPinOverlay: () => set({ pinOverlay: null, pressedPinId: null }),
  pressPin: (pressedPinId) => set({ pressedPinId }),
  clearPressedPin: () => set({ pressedPinId: null }),
  requestKeepMapLevel: () => set({ keepMapLevelOnce: true }),
  consumeKeepMapLevel: () => {
    const keep = get().keepMapLevelOnce;
    if (keep) set({ keepMapLevelOnce: false });
    return keep;
  },
  // 빈 목록은 같은 배열을 돌려준다. 비울 때마다 새 배열이면 그때마다 구독자가 다시 그려진다.
  setNearbyPlaces: (places) => set({ nearbyPlaces: places.length === 0 ? NO_NEARBY_PLACES : places }),
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
