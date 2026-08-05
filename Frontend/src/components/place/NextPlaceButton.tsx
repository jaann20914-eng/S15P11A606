import { Animated, Pressable, StyleSheet } from 'react-native';
import type { ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/constants/theme';

/**
 * **옆 장소로 돌려 보는 버튼.** 지도 위 컨트롤이라 내 위치 버튼 아래에 같은 모양으로 붙는다.
 *
 * 20m까지 당기면 가장 가까운 장소의 상세가 저절로 열리는데, 화면에 여러 곳이 담겨 있으면 그
 * 한 곳이 사용자가 노린 곳이 아닐 수 있다. 누를 때마다 다음으로 가까운 장소로 넘어가고 끝에서는
 * 처음으로 돌아온다 — **그 판단과 이동은 `useNextPlace`가 한다.** 여기는 모양만 갖는다.
 *
 * 홈과 장소 상세가 같은 것을 쓴다. 두 화면이 각자 만들면 같은 자리의 버튼이 서로 달라진다.
 *
 * 아이콘은 **돌아가는 화살표 하나**다. 와이어프레임에는 돋보기가 함께 있었지만 찾는 동작이 아니라
 * 이미 찾은 것들을 돌려 보는 동작이라, 팀 의견을 따라 화살표만 남겼다(2026-08-05).
 */

export interface NextPlaceButtonProps {
  onPress: () => void;
  /** 나타남·사라짐 모션을 얹을 자리. `useFadeToggle`의 `style`을 그대로 넘긴다. */
  style?: Animated.WithAnimatedObject<ViewStyle>;
}

/** 애니메이션을 얹을 수 있는 누를 것. 감싸면 배치 속성이 두 곳으로 갈린다(홈·상세와 같은 이유). */
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function NextPlaceButton({ onPress, style }: NextPlaceButtonProps) {
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel="옆에 있는 다른 장소 보기"
      accessibilityHint="화면에 담긴 다음 장소의 영상핀으로 넘어갑니다"
      onPress={onPress}
      style={[s.button, style]}
    >
      <Ionicons name="sync" size={22} color={colors.dark} />
    </AnimatedPressable>
  );
}

const s = StyleSheet.create({
  /**
   * 내 위치 버튼과 **같은 크기·같은 바닥**이다. 지도 위에 뜬 컨트롤이 나란히 놓이므로 하나만
   * 달라도 줄이 어긋나 보인다. 위 여백만 두어 그 버튼 아래에 붙는다.
   */
  button: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
    marginTop: spacing.x2,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.94)',
    shadowColor: colors.dark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 7,
  },
});
