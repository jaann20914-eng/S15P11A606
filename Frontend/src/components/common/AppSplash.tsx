import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, View } from 'react-native';
import { colors } from '@/constants/theme';
import { RING_FRAMES, SPLASH_DOT } from './splashFrames';

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
 * 호는 미리 구워 둔 프레임(`splashFrames`)을 **전부 겹쳐 두고 투명도만 넘겨** 그린다.
 * 상태로 소스를 갈아 끼우는 방식은 프레임마다 JS 렌더 + 이미지 디코드 + 안드로이드의
 * 기본 페이드가 겹쳐 심하게 끊겼다(2026-08-06). 겹쳐 두면 첫 300ms 대기 동안 디코드가
 * 끝나고, 그 뒤로는 네이티브 드라이버가 투명도만 바꾸므로 자바스크립트가 바빠도 매끈하다.
 */
export function AppSplash({ onFinish }: AppSplashProps) {
  /** 그리기 진행률 0~1. 프레임마다 자기 구간에서만 보이도록 투명도로 보간된다. */
  const draw = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const dotScale = useRef(new Animated.Value(0.2)).current;
  const dotOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    /* 그리기와 돌기는 같은 순간 출발한다(시안의 0.3s 지연). 전부 네이티브 드라이버다. */
    Animated.parallel([
      Animated.timing(draw, {
        toValue: 1,
        duration: DRAW_MS,
        delay: START_DELAY_MS,
        easing: Easing.bezier(0.35, 0, 0.12, 1),
        useNativeDriver: true,
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
    // 마운트에 한 번이다. onFinish는 부모가 렌더마다 새로 만들 수 있어 의존값으로 부적합하다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['-180deg', '0deg'] });

  /*
    누름은 막는다(`pointerEvents`를 열지 않는다). 아래에는 이미 첫 화면이 그려져 있어서,
    통과시키면 보이지 않는 버튼이 눌린다.
  */
  return (
    <Animated.View style={[s.screen, { opacity }]}>
      <View style={s.stage}>
        {/*
          점은 링과 **함께 돌지 않는다.** 시안에서도 점은 제자리에서 튀어나오고 링만 돈다.
          그래서 회전은 프레임 묶음에만 건다.
        */}
        <Animated.View style={[s.ring, { transform: [{ rotate }] }]}>
          {RING_FRAMES.map((source, index) => (
            <Animated.Image
              key={index}
              source={source}
              // 안드로이드의 기본 등장 페이드(300ms)를 끈다. 겹친 프레임이 뿌옇게 섞인다.
              fadeDuration={0}
              style={[s.frame, { opacity: frameOpacity(draw, index) }]}
            />
          ))}
        </Animated.View>

        <Animated.View style={[s.dot, { opacity: dotOpacity, transform: [{ scale: dotScale }] }]}>
          <Image source={SPLASH_DOT} fadeDuration={0} style={s.dotImage} />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

/**
 * 프레임 하나가 보이는 구간.
 *
 * 진행률을 프레임 수로 나눈 자기 구간에서만 1이고 벗어나면 0이다. 구간 경계에 반 프레임의
 * 겹침을 두어 하드 컷 대신 짧은 크로스페이드로 넘어간다 — 4도 간격의 단이 이것으로 지워진다.
 * 마지막 프레임은 끝까지 남는다(clamp).
 */
function frameOpacity(draw: Animated.Value, index: number) {
  const last = RING_FRAMES.length - 1;

  if (index === 0) {
    return draw.interpolate({
      inputRange: [0, 1 / last],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    });
  }

  if (index === last) {
    return draw.interpolate({
      inputRange: [(last - 1) / last, 1],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    });
  }

  return draw.interpolate({
    inputRange: [(index - 1) / last, index / last, (index + 1) / last],
    outputRange: [0, 1, 0],
    extrapolate: 'clamp',
  });
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
   * 프레임 묶음. 상자 전체를 차지하고 그 안에 56장이 겹쳐 있다.
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
  frame: { ...StyleSheet.absoluteFillObject, width: STAGE_SIZE, height: STAGE_SIZE },
  dot: { position: 'absolute', left: DOT_LEFT, top: DOT_TOP, width: DOT_SIZE, height: DOT_SIZE },
  dotImage: { width: '100%', height: '100%' },
});
