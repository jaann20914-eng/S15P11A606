import type { StyleProp, ViewStyle } from 'react-native';
import type { MapPlaceMarker, MapViewState } from './kakaoMapHtml';
import type { Coordinate } from '@/store/useMapStore';
import type { CrowdFilter } from '@/constants/crowdLevels';

/** 네이티브(WebView) 구현과 웹(iframe) 구현이 공유하는 인터페이스. */
export interface KakaoMapProps {
  /** 지도에 그릴 장소 핀. 혼잡도 필터로 걸러진 목록을 그대로 넘긴다. */
  places: MapPlaceMarker[];
  /**
   * 계열을 갖고 오지 않은 마커에 쓸 색 (`relaxed` 라임 / `wagle` 코럴).
   *
   * **마커 색은 마커가 정한다**(`MapPlaceMarker.tone`) — 그 장소·핀이 실제로 붐비는 정도다.
   * 이 값은 그것을 모르는 화면을 위한 기본값이고, 혼잡도 토글을 그대로 넘기면 안 된다.
   * 예전에는 이 값 하나가 모든 마커를 칠해서, 걸러지지 않은 마커의 색이 거짓이 됐다.
   */
  filter: CrowdFilter;
  /** 선택된 핀만 물방울형으로 강조된다. */
  selectedPlaceId?: string | null;
  /** 최초 중심 좌표. 이후 변경은 `ref.panTo`로 처리해 지도를 다시 로드하지 않는다. */
  center: Coordinate;
  /**
   * 최초 확대 레벨(카카오 기준 1~14, 작을수록 확대). 생략하면 `DEFAULT_MAP_LEVEL`.
   *
   * 지도를 만들 때 한 번만 반영된다 — `center`와 같다. 이후 변경은 `ref.setLevel`로 한다.
   *
   * 한 장소만 보여주는 화면은 이 값을 주는 편이 낫다. 지도가 준비된 뒤 `setLevel`로 당기면
   * 확대 애니메이션이 시작 시점의 중심을 붙잡고 있다가 끝나며 그 자리로 되돌려, 방금 옮긴
   * 중심이 취소될 수 있다.
   */
  level?: number;
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
  /**
   * 바텀시트 등에 가려지는 하단 높이(px).
   * 중심 이동 시 마커가 가려지지 않도록 보이는 영역의 중앙에 오게 보정한다.
   */
  bottomInset?: number;
}

/** 지도 이동 방식. */
export interface PanOptions {
  /**
   * 손으로 밀듯 이어서 움직일지. 기본은 `true`.
   *
   * 사용자가 목록이나 핀을 눌러 옮기는 경우에는 켜 둔다 — 화면이 갑자기 바뀌면 어디서
   * 어디로 갔는지 알 수 없다. 첫 화면을 잡는 단계처럼 "원래 그 자리였던" 것으로 보여야
   * 할 때만 끈다.
   *
   * 이동 거리가 화면보다 크면 SDK가 스스로 애니메이션을 건너뛴다.
   */
  animate?: boolean;
}

/**
 * 손가락으로 지도를 직접 다루는 부분만 따로 뽑은 것.
 *
 * **지도를 갖지 않은 화면이 쓴다.** 장소 상세는 홈 지도를 반투명하게 비추고 있을 뿐이라 손가락이
 * WebView까지 닿지 않는다(안드로이드에서 위에 겹친 화면이 터치를 삼킨다). 그래서 상세가 제스처를
 * 받아 이 세 가지로 넘긴다 — 지도 쪽 구현은 `kakaoMapHtml.ts`의 같은 이름 메서드에 있다.
 *
 * `KakaoMapHandle`이 이 모양을 그대로 갖는다. 지도 저장소(`useMapStore`)는 컴포넌트를 알 필요가
 * 없도록 이 최소 모양만 들고 있는다.
 */
export interface MapGestureControl {
  /** 화면 픽셀만큼 지도를 끈다. 손가락이 간 방향으로 지도가 따라온다. */
  dragBy: (dx: number, dy: number) => void;
  /** 끄는 손을 뗐다. 멈춘 자리를 지도가 알린다. */
  dragEnd: () => void;
  /** 중심을 그대로 두고 한 단계 당기거나(양수) 넓힌다(음수). */
  zoomBy: (step: number) => void;
  /**
   * 화면의 그 점(왼쪽 위를 0,0으로 본 픽셀)을 탭한 것으로 다룬다.
   *
   * 지도를 직접 누를 수 없는 화면이 마커를 고를 수 있게 한다 — 그 화면이 깔아 둔 제스처 판이
   * 터치를 먼저 잡아 지도의 click이 일어나지 않기 때문이다. 결과는 지도를 직접 누른 것과 같은
   * 통로로 온다(`onPinPress` · `onMapPress`).
   */
  tapAt: (x: number, y: number) => void;
}

export interface KakaoMapHandle extends MapGestureControl {
  /** 좌표를 보이는 영역의 중앙으로 옮긴다. 기본은 부드럽게 이어서 움직인다. */
  panTo: (coordinate: Coordinate, options?: PanOptions) => void;
  /**
   * 장소 하나를 들여다본다. 중앙으로 부드럽게 옮기고, 더 멀리 보고 있었다면 `targetLevel`까지
   * 당긴다. 이미 그보다 가까이 보고 있으면 축척은 건드리지 않는다.
   *
   * 옮기는 것과 당기는 것 모두 이어지는 움직임으로 보인다. 순서와 중심 보정을 왜 그렇게
   * 처리하는지는 `kakaoMapHtml.ts`의 `focusPlace`에 적어 두었다.
   */
  focusPlace: (coordinate: Coordinate, targetLevel: number) => void;
  setLevel: (level: number) => void;
  /** 현재 핀이 모두 보이도록 지도 영역을 맞춘다. */
  fitPlaces: () => void;
  relayout: () => void;
}
