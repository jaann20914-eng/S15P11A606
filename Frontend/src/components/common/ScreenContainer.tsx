import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { useScreenLayout } from '@/hooks/useResponsivePadding';
import { color } from '@/constants/theme';

export type ScreenEdge = 'top' | 'bottom';

export interface ScreenContainerProps {
  children: ReactNode;
  /** Safe Area inset을 적용할 방향. 탭 바가 있는 화면은 `['top']`만 준다. */
  edges?: readonly ScreenEdge[];
  /** 좌우 반응형 여백 적용 여부. 지도처럼 전면을 채우는 화면은 false. */
  padded?: boolean;
  background?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * 반응형 좌우 여백(`useResponsivePadding`)과 Safe Area inset을 결합한 공통 화면 컨테이너.
 * 화면마다 `width < 360 ? ... : ...` 분기를 반복하지 않기 위한 진입점이다.
 */
export function ScreenContainer({
  children,
  edges = ['top', 'bottom'],
  padded = true,
  background = color.bg.base,
  style,
}: ScreenContainerProps) {
  const { padding, insets } = useScreenLayout();

  return (
    <View
      style={[
        s.screen,
        {
          backgroundColor: background,
          paddingTop: edges.includes('top') ? insets.top : 0,
          paddingBottom: edges.includes('bottom') ? insets.bottom : 0,
          paddingHorizontal: padded ? padding : 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
});
