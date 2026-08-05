import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

/**
 * 영상이 준비되기 전 그 자리를 채우는 층.
 *
 * 핀 상세에서 쓰던 것을 그대로 공용으로 올렸다 — 수정 화면의 기존 영상도 같은 기다림이 있어
 * 같은 모양이어야 한다. 회색 판 위로 빛줄기가 위에서 아래로 지나가며, 비어 있는 것이 아니라
 * 받는 중임을 알린다. 부모(영상 프레임)를 절대 배치로 가득 채우므로 준비되면 부모가 지운다.
 *
 * 방향이 아래로 흐르는 이유: 프레임이 가로로 넓어 좌우로 지나가면 순식간에 스쳐 지나가는데,
 * 위아래로 흐르면 같은 시간에 더 천천히 채워지는 것처럼 보인다.
 */

/** 빛줄기가 위에서 아래로 한 번 지나가는 시간(ms). */
const SWEEP_MS = 1100;

/** 빛줄기 높이. 프레임 높이에 대한 비율이다. 좁으면 선처럼 보이고 넓으면 번쩍이는 판이 된다. */
const SWEEP_RATIO = 0.6;

/**
 * 빛줄기의 색.
 *
 * 진하게 두면 대비가 커서 줄기만 눈에 튄다. 바탕보다 한 단계 밝은 회색으로 보일 만큼만
 * 올린다 — 판이 훑히는 것으로 읽히면 그것으로 충분하다.
 */
const SWEEP_COLORS = ['rgba(255,255,255,0)', 'rgba(255,255,255,0.16)', 'rgba(255,255,255,0)'] as const;

export function MediaLoadingSweep() {
  const sweep = useRef(new Animated.Value(0)).current;
  /** 빛줄기가 지나갈 거리를 알아야 해서 프레임 높이를 잰다. 재기 전에는 그리지 않는다. */
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (height === 0) return;

    sweep.setValue(0);

    const loop = Animated.loop(
      Animated.timing(sweep, { toValue: 1, duration: SWEEP_MS, useNativeDriver: true }),
    );

    loop.start();

    return () => loop.stop();
  }, [sweep, height]);

  const bandHeight = height * SWEEP_RATIO;

  return (
    <View
      style={styles.backdrop}
      pointerEvents="none"
      onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
    >
      {height > 0 && (
        <Animated.View
          style={[
            styles.band,
            {
              height: bandHeight,
              // 프레임 위쪽 밖에서 들어와 아래쪽 밖으로 빠진다. 끊기는 자리가 보이지 않는다.
              transform: [
                {
                  translateY: sweep.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-bandHeight, height],
                  }),
                },
              ],
            },
          ]}
        >
          <LinearGradient
            colors={[...SWEEP_COLORS]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.bandFill}
          />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  /**
   * 바탕은 테마의 회색보다 진하게 둔다. 옅은 회색은 흰 화면에 묻혀 빈 자리처럼 보이고,
   * 그 위를 지나는 빛줄기도 드러나지 않는다.
   */
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6D6D6D',
  },
  band: { position: 'absolute', top: 0, left: 0, right: 0 },
  bandFill: { flex: 1 },
});
