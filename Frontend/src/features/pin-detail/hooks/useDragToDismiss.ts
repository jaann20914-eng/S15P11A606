import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Animated, PanResponder } from 'react-native';
import type { GestureResponderHandlers } from 'react-native';

export interface DragToDismiss {
  /** 시트에 그대로 얹는 이동값. */
  translateY: Animated.Value;
  /** 손잡이 영역에 펼친다. */
  panHandlers: GestureResponderHandlers;
}

/** 이 거리 이상 끌어내리면 닫는다. 살짝 스치는 동작으로 닫히지 않을 만큼은 된다. */
const DISMISS_DISTANCE = 120;

/** 짧게 튕겨도 닫히도록 하는 속도 기준(px/ms). */
const DISMISS_VELOCITY = 0.8;

/** 닫을 때 아래로 밀어내는 거리. 화면 밖으로 나가기만 하면 되므로 넉넉히 잡는다. */
const EXIT_DISTANCE = 600;

/**
 * 아래로 끌어 내려 닫는 동작.
 *
 * 시트는 화면 아래에 붙어 있으므로 닫는 몸짓도 아래여야 자연스럽다. 닫기 버튼을 따로 두면
 * 손이 위로 올라가야 하고, 시트 위쪽은 한 손으로 닿기 어려운 자리다.
 *
 * 잠겨 있는 동안(`locked`)에는 끌어도 닫히지 않고 제자리로 돌아온다. 결제가 진행 중일 때
 * 화면이 사라지면 사용자는 결제가 취소된 것으로 읽는다.
 */
export function useDragToDismiss(visible: boolean, locked: boolean, onDismiss: () => void): DragToDismiss {
  const translateY = useRef(new Animated.Value(0)).current;

  /* 다시 열릴 때는 늘 제자리에서 시작한다. 닫으며 밀어낸 값이 남아 있으면 화면 밖에서 열린다. */
  useEffect(() => {
    if (visible) translateY.setValue(0);
  }, [translateY, visible]);

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
          if (!enough || lockedRef.current) {
            settle();
            return;
          }

          Animated.timing(translateY, {
            toValue: EXIT_DISTANCE,
            duration: 180,
            useNativeDriver: true,
          }).start(({ finished }) => {
            if (finished) onDismiss();
          });
        },
        onPanResponderTerminate: settle,
      }),
    [onDismiss, settle, translateY],
  );

  return { translateY, panHandlers: panResponder.panHandlers };
}
