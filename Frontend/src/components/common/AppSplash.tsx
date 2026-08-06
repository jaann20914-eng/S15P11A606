import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, View } from 'react-native';
import { colors } from '@/constants/theme';
import { LAST_RING_FRAME, SPLASH_DOT, ringFrame } from './splashFrames';

/** 한 장(10도)을 넘기는 간격(ms). 23장이라 그리는 데 약 1.1초 걸린다. */
const FRAME_MS = 50;

/** 링이 다 그려진 뒤 점이 튀어나오기까지 기다리는 시간(ms). */
const DOT_DELAY_MS = 240;

/** 다 보여준 뒤 화면을 걷기까지 머무는 시간(ms). */
const HOLD_MS = 420;

/** 걷히는 시간(ms). */
const FADE_MS = 320;

/**
 * 시안 상자(340) 대비 실제 크기.
 *
 * 프레임 이미지가 그 상자를 통째로 담고 있어(링은 그 안에 그려져 있다) 이 값이 곧 그림 크기다.
 */
const STAGE_SIZE = 300;

/** 시안 좌표를 실제 크기로 옮긴다. 상자가 340 기준이다. */
function scaled(value: number): number {
  return Math.round((value / 340) * STAGE_SIZE);
}

/** 점의 지름과 자리. 시안의 `cx=310 cy=56 r=28`을 옮긴 값이다(그림에 여유 2px 포함). */
const DOT_SIZE = scaled(60);
const DOT_LEFT = scaled(310) - DOT_SIZE / 2;
const DOT_TOP = scaled(56) - DOT_SIZE / 2;

export interface AppSplashProps {
  /** 다 끝나 화면에서 빠질 때. 이때 부모가 이 컴포넌트를 내린다. */
  onFinish: () => void;
}

/**
 * 앱을 열 때 한 번 지나가는 시작 화면.
 *
 * 시안(`assets/View-Splash.html`)을 그대로 옮겼다 — 회색 트랙 위로 그라데이션 호가 220도까지
 * 그려지며 함께 돌고, 다 그려지면 오른쪽 위에 도넛 점이 튀어나온다. 이 앱의 이름이 곧
 * "뷰"라 로고 대신 그 링이 그려지는 장면을 쓴다.
 *
 * 호는 미리 구워 둔 프레임을 넘겨 그린다(`splashFrames`). SVG로 그리면 네이티브 모듈이
 * 늘어 앱을 다시 빌드해야 하는데, 그림이 고정이라 그럴 이유가 없다.
 *
 * 회전과 사라짐은 네이티브 드라이버로 돌린다. 자바스크립트가 첫 화면을 준비하느라 바쁜
 * 시점이라, 그쪽에서 굴리면 애니메이션이 끊긴다.
 */
export function AppSplash({ onFinish }: AppSplashProps) {
  /** 지금 보여줄 프레임. 한 장이 10도다. */
  const [frame, setFrame] = useState(0);

  const opacity = useRef(new Animated.Value(1)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const dotScale = useRef(new Animated.Value(0)).current;

  /* 링이 그려지는 동안 함께 돈다. 그리기와 돌기가 겹쳐 하나의 동작으로 읽힌다(시안의 `.spin`). */
  useEffect(() => {
    Animated.timing(spin, {
      toValue: 1,
      duration: FRAME_MS * LAST_RING_FRAME + 200,
      easing: Easing.bezier(0.3, 0, 0.15, 1),
      useNativeDriver: true,
    }).start();
  }, [spin]);

  /* 한 장씩 넘겨 호를 그린다. 끝까지 가면 점을 띄우고, 잠시 뒤 화면을 걷는다. */
  useEffect(() => {
    let index = 0;

    const timer = setInterval(() => {
      index += 1;
      setFrame(index);

      if (index < LAST_RING_FRAME) return;

      clearInterval(timer);

      Animated.sequence([
        Animated.delay(DOT_DELAY_MS),
        Animated.spring(dotScale, {
          toValue: 1,
          damping: 9,
          stiffness: 170,
          mass: 0.6,
          useNativeDriver: true,
        }),
        Animated.delay(HOLD_MS),
        Animated.timing(opacity, {
          toValue: 0,
          duration: FADE_MS,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) onFinish();
      });
    }, FRAME_MS);

    return () => clearInterval(timer);
    // 마운트에 한 번이다. onFinish는 부모가 렌더마다 새로 만들 수 있어 의존값으로 부적합하다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
    누름은 막는다(`pointerEvents`를 열지 않는다). 아래에는 이미 첫 화면이 그려져 있어서,
    통과시키면 보이지 않는 버튼이 눌린다.
  */
  return (
    <Animated.View style={[s.screen, { opacity }]}>
      <View style={s.stage}>
        {/*
          점은 링과 **함께 돌지 않는다.** 시안에서도 점은 제자리에서 튀어나오고 링만 돈다.
          그래서 회전은 링 그림에만 건다.
        */}
        <Animated.Image
          source={ringFrame(frame)}
          style={[
            s.ring,
            {
              transform: [
                {
                  rotate: spin.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['-180deg', '0deg'],
                  }),
                },
              ],
            },
          ]}
        />

        <Animated.View style={[s.dot, { transform: [{ scale: dotScale }] }]}>
          <Image source={SPLASH_DOT} style={s.dotImage} />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  screen: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    // 네이티브 시작 화면과 같은 색이라 앱이 뜨는 순간이 이어져 보인다.
    backgroundColor: colors.bg,
    // 첫 화면 위에 덮는다. 아래에서 라우터가 준비를 마쳐도 이 화면이 끝날 때까지 가려 둔다.
    zIndex: 100,
  },
  /** 시안 상자를 그대로 옮긴 자리. 링과 점의 좌표가 모두 이 안에서 정해진다. */
  stage: { width: STAGE_SIZE, height: STAGE_SIZE },
  /**
   * 링 그림. 상자 전체를 담고 있어 크기가 곧 상자 크기다.
   *
   * 도는 중심을 **링의 중심**으로 잡는다(시안의 `transform-origin:160px 180px`). 링이 상자
   * 한가운데가 아니라 조금 왼쪽 아래에 놓여 있어서, 기본값(그림 중앙)으로 돌리면 제자리에서
   * 도는 대신 원을 그리며 흔들린다.
   */
  ring: {
    width: STAGE_SIZE,
    height: STAGE_SIZE,
    transformOrigin: [scaled(160), scaled(180), 0],
  },
  dot: { position: 'absolute', left: DOT_LEFT, top: DOT_TOP, width: DOT_SIZE, height: DOT_SIZE },
  dotImage: { width: '100%', height: '100%' },
});
