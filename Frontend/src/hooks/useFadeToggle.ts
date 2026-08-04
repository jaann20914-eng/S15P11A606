import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';
import type { ViewStyle } from 'react-native';

/**
 * 조건에 따라 사라지고 나타나는 요소의 모션.
 *
 * 지도 위에 떠 있는 컨트롤을 시트 단계에 맞춰 감추는 데 쓴다. 조건을 그대로 `&&`로 걸면
 * 요소가 **툭 없어지고 툭 생긴다** — 시트는 스프링으로 부드럽게 움직이는데 그 위 버튼만
 * 순간이동하면 두 움직임이 따로 노는 것으로 보인다.
 *
 * 홈과 장소 상세가 같은 버튼을 각자 감춘다. 두 화면이 나란히 이어지므로 사라지는 방식이
 * 다르면 화면을 옮길 때 눈에 띈다. 그래서 모션은 여기 한 벌만 둔다.
 *
 * 되돌아올 때만 살짝 튕긴다(`Easing.back`). 사라질 때는 튕기면 미련이 남아 보여 곧게 끝낸다.
 */

/** 나타나는 시간(ms). 사라질 때는 더 빠르게 끝낸다 — 기다릴 이유가 없다. */
const SHOW_MS = 240;
const HIDE_MS = 160;

/** 감춰졌을 때의 크기. 0으로 줄이면 사라지는 것이 아니라 빨려 들어가는 것으로 보인다. */
const HIDDEN_SCALE = 0.82;

/** 되돌아올 때 목표를 살짝 지나치는 정도. 커질수록 통통 튄다. */
const OVERSHOOT = 1.6;

export interface FadeToggle {
  /**
   * 지금 붙여 둬야 하는지.
   *
   * 사라지는 모션을 다 보여준 **뒤에** false가 된다. 조건이 꺼지는 순간 떼어 내면 모션이
   * 나올 새가 없으므로, 화면은 이 값으로 붙일지 말지 정해야 한다.
   */
  mounted: boolean;
  /** 요소에 그대로 얹는다. 네이티브 드라이버로 도므로 레이아웃을 다시 계산하지 않는다. */
  style: Animated.WithAnimatedObject<ViewStyle>;
}

export function useFadeToggle(visible: boolean): FadeToggle {
  const progress = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    // 나타날 때는 먼저 붙여 둬야 애니메이션이 보인다. 뗄 때는 다 끝난 뒤에 뗀다.
    if (visible) setMounted(true);

    const animation = Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: visible ? SHOW_MS : HIDE_MS,
      easing: visible ? Easing.out(Easing.back(OVERSHOOT)) : Easing.in(Easing.quad),
      useNativeDriver: true,
    });

    animation.start(({ finished }) => {
      // 끝까지 사라진 뒤에만 뗀다. 중간에 다시 켜지면 애니메이션이 취소돼 여기 오지 않는다.
      if (finished && !visible) setMounted(false);
    });

    return () => animation.stop();
  }, [progress, visible]);

  const style = useMemo<Animated.WithAnimatedObject<ViewStyle>>(
    () => ({
      /*
        투명도는 1을 넘지 않게 가둔다. `Easing.back`은 목표를 지나치므로 진행도가 잠깐 1보다
        커지는데, 크기는 그 덕에 통통 튀지만 투명도는 1을 넘어 봐야 의미가 없다.
      */
      opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' }),
      transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [HIDDEN_SCALE, 1] }) }],
    }),
    [progress],
  );

  return { mounted, style };
}
