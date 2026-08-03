import { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import { pinCreateStyles as s } from '../styles';

/**
 * 링 그림. 그라데이션과 둥근 끝이 들어간 78% 호를 미리 그려 둔 것이다.
 *
 * `react-native-svg`로 그리면 네이티브 모듈이 하나 늘어 개발 빌드를 다시 만들어야 한다.
 * 모양이 고정이라 미리 그려 두고 돌리기만 해도 결과가 같다.
 *
 * 굵기 · 호의 길이 · 색을 바꾸려면 `scripts/generate-loading-ring.js`의 값을 고치고 다시 돌린다:
 * `node scripts/generate-loading-ring.js assets/images/ai-loading-ring.png`
 */
const RING = require('../../../../assets/images/ai-loading-ring.png');

/** 한 바퀴 도는 데 걸리는 시간. */
const SPIN_DURATION_MS = 1450;

export interface AiLoadingCircleProps {
  /** 링 지름. 안쪽 흰 원과 글자 크기가 이 값을 따라간다. */
  size?: number;
  children: React.ReactNode;
}

/**
 * 도는 링과 그 안의 안내.
 *
 * 천천히 출발해 빠르게 돌고 다시 감속한다. 일정한 속도로 도는 것보다 "무언가 처리하고 있다"는
 * 느낌이 분명하다.
 */
export function AiLoadingCircle({ size = 280, children }: AiLoadingCircleProps) {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    spin.setValue(0);

    const animation = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: SPIN_DURATION_MS,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
    );

    animation.start();

    return () => animation.stop();
  }, [spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  /** 시안 비율. 두께의 2.4배만큼 안쪽으로 들어간 원이 글자 자리다. */
  const stroke = size * 0.045;
  const inner = size - stroke * 2.4;

  return (
    <View style={[s.loader, { width: size, height: size }]}>
      <Animated.Image
        source={RING}
        style={[s.loaderRing, { width: size, height: size, transform: [{ rotate }] }]}
      />

      <View style={[s.loaderCenter, { width: inner, height: inner, borderRadius: inner / 2 }]}>
        {children}
      </View>
    </View>
  );
}
