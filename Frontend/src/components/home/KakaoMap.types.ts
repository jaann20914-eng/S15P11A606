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
