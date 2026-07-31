import type { StyleProp, ViewStyle } from 'react-native';
import type { MapPlaceMarker, MapViewState, ResolvedPlace } from './kakaoMapHtml';
import type { Coordinate } from '@/store/useMapStore';
import type { CrowdFilter } from '@/constants/crowdLevels';

/** 네이티브(WebView) 구현과 웹(iframe) 구현이 공유하는 인터페이스. */
export interface KakaoMapProps {
  /** 지도에 그릴 장소 핀. 혼잡도 필터로 걸러진 목록을 그대로 넘긴다. */
  places: MapPlaceMarker[];
  /** 핀 색 계열 (`relaxed` 라임 / `wagle` 코럴) */
  filter: CrowdFilter;
  /** 선택된 핀만 물방울형으로 강조된다. */
  selectedPlaceId?: string | null;
  /** 최초 중심 좌표. 이후 변경은 `ref.panTo`로 처리해 지도를 다시 로드하지 않는다. */
  center: Coordinate;
  /**
   * 준비되는 즉시 핀이 모두 보이도록 영역을 맞출지.
   *
   * 이 값을 켜면 최초 중심으로 `center` 대신 **핀들의 중심**을 쓴다. 그러지 않으면 지도가
   * `center` 주변 타일을 한 번 받고, 곧바로 핀 영역으로 옮겨 가며 그 타일을 전부 버린다.
   * 두 지점이 멀수록 낭비가 커진다.
   *
   * 화면에서 `onReady`로 `fitPlaces()`를 부르는 것과 결과는 같지만, 낭비되는 왕복이 없다.
   */
  fitPlacesOnReady?: boolean;
  /**
   * 이 화면에서 `searchPlace`를 쓰는지.
   *
   * 검색에 필요한 `libraries=services`는 별도 번들이라 첫 렌더를 늦춘다. 쓰는 화면만 켠다.
   */
  usePlaceSearch?: boolean;
  myLocation?: Coordinate | null;
  fullScreen?: boolean;
  style?: StyleProp<ViewStyle>;
  onPinPress?: (placeId: string) => void;
  /** 빈 지도 영역 탭. 선택 해제에 사용한다. */
  onMapPress?: () => void;
  /** 이동/확대가 멈춘 뒤의 중심·영역. 목록 재조회 트리거로 쓴다. */
  onViewChange?: (view: MapViewState) => void;
  /** 지도 초기화가 끝나 명령을 받을 수 있게 된 시점 */
  onReady?: () => void;
  /** `searchPlace`로 장소를 찾았을 때 */
  onPlaceResolved?: (place: ResolvedPlace) => void;
  /** `searchPlace`가 결과를 찾지 못했을 때 */
  onPlaceNotFound?: (keyword: string, reason: 'no-result' | 'search-failed') => void;
  /**
   * 바텀시트 등에 가려지는 하단 높이(px).
   * 중심 이동 시 마커가 가려지지 않도록 보이는 영역의 중앙에 오게 보정한다.
   */
  bottomInset?: number;
}

export interface KakaoMapHandle {
  /** 좌표를 보이는 영역의 중앙으로 옮긴다. */
  panTo: (coordinate: Coordinate) => void;
  /** 장소명으로 검색해 그 위치로 이동한다. 결과는 `onPlaceResolved`로 온다. */
  searchPlace: (keyword: string) => void;
  setLevel: (level: number) => void;
  /** 현재 핀이 모두 보이도록 지도 영역을 맞춘다. */
  fitPlaces: () => void;
  relayout: () => void;
}
