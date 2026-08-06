import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, View } from 'react-native';
import { colors } from '@/constants/theme';
import { getViewAngleImage } from '@/utils/viewAngle';

/**
 * 링이 그려지는 각도의 끝. 시안의 호 길이(`stroke-dasharray 502 328`)가 원둘레의 약 60%라
 * 220도에 해당한다. 10도 단위 이미지가 있어 그 눈금에 맞춘다.
 */
const SWEEP_END_DEGREES = 220;

/** 한 칸(10도)을 넘기는 간격(ms). 22칸이라 전체는 약 1.1초다. */
const FRAME_MS = 50;

/** 링이 다 그려진 뒤 점이 튀어나오기까지 기다리는 시간(ms). */
const DOT_DELAY_MS = 260;

/** 다 보여준 뒤 화면을 걷기까지 머무는 시간(ms). */
const HOLD_MS = 420;

/** 걷히는 시간(ms). */
const FADE_MS = 320;

/** 링 지름(px). 시안의 비율(340 상자에 지름 264)을 그대로 옮긴다. */
const RING_SIZE = 264;

/** 상자 대비 링 크기. 점의 자리를 시안 좌표로 계산할 때 쓴다. */
const STAGE_SIZE = 340;

export interface AppSplashProps {
  /** 다 끝나 화면에서 빠질 때. 이때 부모가 이 컴포넌트를 내린다. */
  onFinish: () => void;
}

/**
 * 앱을 열 때 한 번 지나가는 시작 화면.
 *
 * 뷰 각도 링이 왼쪽 위에서부터 그려지고, 다 그려지면 오른쪽 위에 점이 튀어나온다. 이 앱의
 * 이름이 곧 "뷰"라, 로고 대신 그 링이 그려지는 장면을 쓴다.
 *
 * **링은 화면에서 이미 쓰는 각도별 이미지를 그대로 넘긴다**(`view-angles-000-360`). 호를
 * 직접 그리려면 SVG가 필요하고 그건 네이티브 모듈이라 앱을 다시 빌드해야 한다 — 같은 그림을
 * 이미 갖고 있으므로 한 칸씩 넘겨 그리는 것으로 충분하다. 프로필의 링과 모양이 정확히 같아
 * 앱 안에서 같은 물건으로 읽히는 이점도 있다.
 *
 * 회전과 사라짐은 네이티브 드라이버로 돌린다. 자바스크립트가 첫 화면을 준비하느라 바쁜
 * 시점이라, 그쪽에서 굴리면 애니메이션이 끊긴다.
 */
export function AppSplash({ onFinish }: AppSplashProps) {
  /** 지금 그려진 각도. 이미지 한 장이 10도다. */
  const [angle, setAngle] = useState(0);

  const opacity = useRef(new Animated.Value(1)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const dotScale = useRef(new Animated.Value(0)).current;

  /* 링이 그려지는 동안 함께 돈다. 그리기와 돌기가 겹쳐 하나의 동작으로 읽힌다. */
  useEffect(() => {
    Animated.timing(spin, {
      toValue: 1,
      duration: FRAME_MS * (SWEEP_END_DEGREES / 10) + 200,
      easing: Easing.bezier(0.3, 0, 0.15, 1),
      useNativeDriver: true,
    }).start();
  }, [spin]);

  /* 한 칸씩 넘겨 호를 그린다. 끝까지 가면 점을 띄우고, 잠시 뒤 화면을 걷는다. */
  useEffect(() => {
    let step = 0;

    const timer = setInterval(() => {
      step += 1;
      setAngle(step * 10);

      if (step * 10 < SWEEP_END_DEGREES) return;

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
        <Animated.Image
          source={getViewAngleImage(angle)}
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

        {/* 오른쪽 위에 튀어나오는 점. 가운데가 비어 있어 링과 같은 물건으로 읽힌다. */}
        <Animated.View style={[s.dot, { transform: [{ scale: dotScale }] }]} />
      </View>
    </Animated.View>
  );
}

/** 시안 좌표(`STAGE_SIZE` 상자 기준)를 실제 링 크기로 옮긴다. */
function scaled(value: number): number {
  return Math.round((value / STAGE_SIZE) * RING_SIZE);
}

/** 점의 지름과 테두리 두께. 시안의 `r=28`(안쪽 구멍 `r=9.5`)을 옮긴 값이다. */
const DOT_OUTER = scaled(56);
const DOT_RING = scaled(18);

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
  /** 링과 점을 함께 담는 자리. 점이 링 밖으로 나가므로 상자를 시안 비율만큼 넓게 잡는다. */
  stage: { width: RING_SIZE, height: RING_SIZE },
  ring: { width: RING_SIZE, height: RING_SIZE, resizeMode: 'contain' },
  dot: {
    position: 'absolute',
    // 시안에서 점은 링 상자의 오른쪽 위 모서리에 걸친다.
    top: -DOT_OUTER / 3,
    right: -DOT_OUTER / 3,
    width: DOT_OUTER,
    height: DOT_OUTER,
    borderRadius: DOT_OUTER / 2,
    borderWidth: DOT_RING,
    borderColor: colors.lime,
    backgroundColor: 'transparent',
  },
});
