import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder } from 'react-native';
import type { GestureResponderHandlers, LayoutChangeEvent } from 'react-native';

export interface SheetTransition {
  /** 화면에 그릴지. 닫히는 동안에도 참이라 내려가는 모습이 보인다. */
  rendered: boolean;
  /** 시트에 얹는 이동값. */
  translateY: Animated.Value;
  /** 어두운 막의 진하기. 시트와 함께 켜지고 꺼진다. */
  backdropOpacity: Animated.Value;
  /** 시트 높이를 재는 데 쓴다. 그만큼만 내려가면 화면 밖이다. */
  onSheetLayout: (event: LayoutChangeEvent) => void;
  /** 손잡이 영역에 펼친다. */
  panHandlers: GestureResponderHandlers;
}

/** 높이를 재기 전에 쓰는 어림값. 첫 프레임에만 쓰인다. */
const ESTIMATED_HEIGHT = 560;

/** 이 거리 이상 끌어내리면 닫는다. 살짝 스치는 동작으로 닫히지 않을 만큼은 된다. */
const DISMISS_DISTANCE = 120;

/** 짧게 튕겨도 닫히도록 하는 속도 기준(px/ms). */
const DISMISS_VELOCITY = 0.8;

const ENTER_DURATION = 260;

/** 내려가는 데 걸리는 시간. 배경 흐림을 함께 거두려면 화면도 이 값을 알아야 한다. */
export const SHEET_EXIT_DURATION = 200;

/**
 * 아래에서 올라오고 아래로 내려가는 시트.
 *
 * 켜고 끄듯 나타났다 사라지면 어디서 온 것인지 알 수 없다. 아래에서 올라오면 "화면 밑에
 * 있던 것을 끌어올렸다"로 읽히고, 닫을 때 같은 길로 내려가면 그 자리에 되돌려 놓은 것이 된다.
 *
 * 닫는 몸짓(손잡이 끌어내리기)도 같은 움직임의 연장이다. 손을 뗀 지점에서 이어서 내려간다.
 *
 * `visible`이 거짓이 되어도 곧바로 사라지지 않는다. 내려가는 동안 계속 그려야 하므로
 * `rendered`가 따로 있다.
 */
export function useSheetTransition(
  visible: boolean,
  locked: boolean,
  onDismiss: () => void,
): SheetTransition {
  const [rendered, setRendered] = useState(visible);
  const height = useRef(ESTIMATED_HEIGHT);

  const translateY = useRef(new Animated.Value(ESTIMATED_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setRendered(true);
      // 화면 밖에서 시작해 제자리로 올라온다.
      translateY.setValue(height.current);
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: ENTER_DURATION,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: ENTER_DURATION,
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    /*
      닫힐 때는 지금 자리에서 이어서 내려간다. 끌어내리다 손을 뗀 경우 그 지점부터 이어지므로
      움직임이 끊기지 않는다. 다 내려간 뒤에야 화면에서 뺀다.
    */
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: height.current,
        duration: SHEET_EXIT_DURATION,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: SHEET_EXIT_DURATION,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) setRendered(false);
    });
  }, [backdropOpacity, translateY, visible]);

  const onSheetLayout = useCallback((event: LayoutChangeEvent) => {
    height.current = event.nativeEvent.layout.height;
  }, []);

  const lockedRef = useRef(locked);
  lockedRef.current = locked;

  const settle = useCallback(() => {
    Animated.spring(translateY, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
  }, [translateY]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // 세로로 끄는 동작만 가로챈다. 살짝 눌린 것과 구분하려고 문턱을 둔다.
        onMoveShouldSetPanResponder: (_event, gesture) => gesture.dy > 4,
        onPanResponderMove: (_event, gesture) => {
          // 위로는 끌리지 않는다. 시트가 화면 위로 떠오를 이유가 없다.
          translateY.setValue(Math.max(0, gesture.dy));
        },
        onPanResponderRelease: (_event, gesture) => {
          const enough = gesture.dy > DISMISS_DISTANCE || gesture.vy > DISMISS_VELOCITY;

          // 잠겨 있으면(결제 중) 아무리 끌어도 제자리로 돌아온다.
          if (!enough || lockedRef.current) {
            settle();
            return;
          }

          // 나머지 하강은 닫힘 처리가 이어서 한다. 여기서 또 내리면 두 번 움직인다.
          onDismiss();
        },
        onPanResponderTerminate: settle,
      }),
    [onDismiss, settle, translateY],
  );

  return {
    rendered,
    translateY,
    backdropOpacity,
    onSheetLayout,
    panHandlers: panResponder.panHandlers,
  };
}
