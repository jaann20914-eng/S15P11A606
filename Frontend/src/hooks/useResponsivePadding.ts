import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { EdgeInsets } from 'react-native-safe-area-context';

/** 피그마/안드로이드 기본 기획 기준 너비 */
const BASE_WIDTH = 360;
const BASE_PADDING = 20;
const MIN_PADDING = 16;
const MAX_PADDING = 28;

/**
 * 화면 너비에 비례한 가변 여백을 계산한다 (순수 함수, 테스트·비훅 호출용).
 * - 360dp 기준 20px
 * - 비율 계산을 적용하되, 레이아웃 파괴를 막기 위해 최소 16px ~ 최대 28px로 제한
 */
export function getResponsivePadding(width: number): number {
  const scale = width / BASE_WIDTH;
  const rawPadding = Math.round(BASE_PADDING * scale);

  return Math.min(Math.max(rawPadding, MIN_PADDING), MAX_PADDING);
}

/** 현재 화면 너비에 비례한 좌우 여백을 반환한다. */
export function useResponsivePadding(): number {
  const { width } = useWindowDimensions();

  return getResponsivePadding(width);
}

export interface ScreenLayout {
  /** 좌우 공통 여백 */
  padding: number;
  /** Safe Area inset 원본 값 */
  insets: EdgeInsets;
  /** 상단 고정 요소(검색창 등)를 노치 아래로 내리기 위한 오프셋 */
  top: number;
  /** 하단 고정 요소를 제스처 바 위로 올리기 위한 오프셋 */
  bottom: number;
}

/**
 * 반응형 여백과 Safe Area inset을 함께 반환한다.
 * 지도처럼 컨테이너 패딩 대신 절대 위치를 쓰는 화면에서 사용한다.
 * 일반 화면은 `ScreenContainer`가 이 훅을 내부에서 적용한다.
 */
export function useScreenLayout(): ScreenLayout {
  const padding = useResponsivePadding();
  const insets = useSafeAreaInsets();

  return {
    padding,
    insets,
    top: insets.top,
    bottom: insets.bottom,
  };
}
