import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, View } from 'react-native';
import { colors } from '@/constants/theme';
import { LAST_RING_FRAME, SPLASH_DOT, ringFrame } from './splashFrames';

/*
  아래 시간과 곡선은 전부 시안(assets/View-Splash.html)의 CSS 애니메이션 값 그대로다.
  - dash: 1.2s, 0.3s 지연, cubic-bezier(.35,0,.12,1)
  - spin: 1.3s, 0.3s 지연, cubic-bezier(.3,0,.15,1), -180° → 0°
  - ping: 0.5s, 1.65s 지연, cubic-bezier(.2,.8,.3,1), 0.2 → 1.25 → 0.94 → 1
*/
const START_DELAY_MS = 300;
const DRAW_MS = 1200;
const SPIN_MS = 1300;
const DOT_AT_MS = 1650;
const DOT_MS = 500;

/** 다 보여준 뒤 화면을 걷기까지 머무는 시간(ms)과 걷히는 시간(ms). */
const HOLD_MS = 420;
const FADE_MS = 320;

/** 시안 상자(340) 대비 실제 크기. */
const STAGE_SIZE = 150;

/** 화면 정중앙에서 위로 끌어올리는 거리(px). */
const RAISE = 72;

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
 * 프레임 넘김은 시안의 곡선을 태운 Animated 값이 정한다. 일정한 간격으로 넘겼더니
 * 처음엔 빠르고 끝에서 감속하는 시안과 속도감이 달라 버벅여 보였다(2026-08-06).
 */
export function AppSplash({ onFinish }: AppSplashProps) {
  /** 지금 보여줄 프레임. 한 장이 4도다. */
  const [frame, setFrame] = useState(0);

  /** 그리기 진행률 0~1. 곡선을 태워 프레임 번호로 바꾼다. 리스너가 필요해 JS 드라이버다. */
  const draw = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const dotScale = useRef(new Animated.Value(0)).current;
  const dotOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const listener = draw.addListener(({ value }) => {
      setFrame(Math.round(value * LAST_RING_FRAME));
    });

    /* 그리기와 돌기는 같은 순간 출발한다(시안의 0.3s 지연). */
    Animated.parallel([
      Animated.timing(draw, {
        toValue: 1,
        duration: DRAW_MS,
        delay: START_DELAY_MS,
        easing: Easing.bezier(0.35, 0, 0.12, 1),
        useNativeDriver: false,
      }),
      Animated.timing(spin, {
        toValue: 1,
        duration: SPIN_MS,
        delay: START_DELAY_MS,
        easing: Easing.bezier(0.3, 0, 0.15, 1),
        useNativeDriver: true,
      }),
    ]).start();

    /*
      점은 시안의 keyframes(0.2 → 1.25 → 0.94 → 1)를 구간별 timing으로 옮긴다.
      스프링으로 두었더니 튀는 정도가 실행마다 달라 시안과 어긋났다.
    */
    dotScale.setValue(0.2);
    Animated.sequence([
      Animated.delay(DOT_AT_MS),
      Animated.parallel([
        Animated.timing(dotOpacity, {
          toValue: 1,
          duration: DOT_MS * 0.6,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(dotScale, {
            toValue: 1.25,
            duration: DOT_MS * 0.6,
            easing: Easing.bezier(0.2, 0.8, 0.3, 1),
            useNativeDriver: true,
          }),
          Animated.timing(dotScale, {
            toValue: 0.94,
            duration: DOT_MS * 0.2,
            useNativeDriver: true,
          }),
          Animated.timing(dotScale, {
            toValue: 1,
            duration: DOT_MS * 0.2,
            useNativeDriver: true,
          }),
        ]),
      ]),
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

    return () => draw.removeListener(listener);
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

        <Animated.View style={[s.dot, { opacity: dotOpacity, transform: [{ scale: dotScale }] }]}>
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
  /** 시안 상자를 그대로 옮긴 자리. 정중앙보다 조금 위에 놓는다. */
  stage: {
    width: STAGE_SIZE,
    height: STAGE_SIZE,
    transform: [{ translateY: -RAISE }],
  },
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
