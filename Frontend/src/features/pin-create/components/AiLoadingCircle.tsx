import { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import { pinCreateStyles as s } from '../styles';

/**
 * 길이가 다른 링 그림들. 짧은 것부터 긴 것까지 아홉 장이다.
 *
 * `react-native-svg`로 그리면 네이티브 모듈이 하나 늘어 개발 빌드를 다시 만들어야 한다.
 * 모양이 정해져 있으므로 미리 그려 두고, 겹쳐 놓은 채 서로 흐려지고 나타나게 해서 호가
 * 자라고 줄어드는 것처럼 보이게 한다.
 *
 * 굵기 · 색 · 길이를 바꾸려면 `scripts/generate-loading-ring.js`로 다시 뽑는다:
 * `node scripts/generate-loading-ring.js assets/images/ai-loading-ring-0.png 320 0.12`
 */
const RINGS = [
  require('../../../../assets/images/ai-loading-ring-0.png'),
  require('../../../../assets/images/ai-loading-ring-1.png'),
  require('../../../../assets/images/ai-loading-ring-2.png'),
  require('../../../../assets/images/ai-loading-ring-3.png'),
  require('../../../../assets/images/ai-loading-ring-4.png'),
  require('../../../../assets/images/ai-loading-ring-5.png'),
  require('../../../../assets/images/ai-loading-ring-6.png'),
  require('../../../../assets/images/ai-loading-ring-7.png'),
  require('../../../../assets/images/ai-loading-ring-8.png'),
];

/** 한 바퀴 도는 데 걸리는 시간. 호가 자랐다 줄어드는 것도 이 주기를 따른다. */
const SPIN_DURATION_MS = 1450;

/** 반 바퀴에 짧은 것에서 긴 것까지 간다. 나머지 반 바퀴는 그 길을 되돌아온다. */
const STEPS = (RINGS.length - 1) * 2;

export interface AiLoadingCircleProps {
  /** 링 지름. 안쪽 흰 원이 이 값을 따라간다. */
  size?: number;
  children: React.ReactNode;
}

/**
 * 도는 링과 그 안의 안내.
 *
 * 한 바퀴 도는 동안 호가 길어졌다가, 처음 자리로 돌아오면서 다시 짧아진다. 길이가 고정된
 * 원이 도는 것보다 "무언가 진행되고 있다"는 느낌이 분명하다.
 *
 * 회전과 길이 모두 하나의 값에서 나온다. 둘이 따로 돌면 가장 길어지는 지점이 매번 달라져
 * 규칙이 없어 보인다.
 */
export function AiLoadingCircle({ size = 280, children }: AiLoadingCircleProps) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progress.setValue(0);

    const animation = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: SPIN_DURATION_MS,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
    );

    animation.start();

    return () => animation.stop();
  }, [progress]);

  const rotate = progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  /** 시안 비율. 두께의 2.4배만큼 안쪽으로 들어간 원이 글자 자리다. */
  const stroke = size * 0.045;
  const inner = size - stroke * 2.4;

  return (
    <View style={[s.loader, { width: size, height: size }]}>
      <Animated.View
        pointerEvents="none"
        style={[s.loaderRing, { width: size, height: size, transform: [{ rotate }] }]}
      >
        {RINGS.map((ring, index) => (
          <Animated.Image
            key={index}
            source={ring}
            style={[
              s.loaderRingFrame,
              { width: size, height: size, opacity: frameOpacity(progress, index) },
            ]}
          />
        ))}
      </Animated.View>

      <View style={[s.loaderCenter, { width: inner, height: inner, borderRadius: inner / 2 }]}>
        {children}
      </View>
    </View>
  );
}

/**
 * 이 장면이 언제 보일지.
 *
 * 한 바퀴를 `STEPS`칸으로 나누고, 자기 차례에서 1이 되고 앞뒤 칸에서 0이 되게 한다. 이웃끼리
 * 겹치는 동안 서로 흐려지고 나타나므로 칸이 넘어가는 것이 눈에 띄지 않는다.
 *
 * 되돌아오는 구간(반 바퀴 뒤)에서도 같은 장면을 쓰므로 봉우리가 둘이다. 첫 장면은 시작과 끝에
 * 걸쳐 있어 양 끝이 봉우리가 된다.
 */
function frameOpacity(progress: Animated.Value, index: number): Animated.AnimatedInterpolation<number> {
  const peaks = [index, STEPS - index];
  const inputRange: number[] = [];
  const outputRange: number[] = [];

  for (let step = 0; step <= STEPS; step += 1) {
    inputRange.push(step / STEPS);
    outputRange.push(peaks.includes(step) ? 1 : 0);
  }

  return progress.interpolate({ inputRange, outputRange });
}
