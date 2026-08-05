import { useMemo, useRef } from 'react';
import { PanResponder } from 'react-native';
import type { GestureResponderEvent, GestureResponderHandlers } from 'react-native';
import type { MapGestureControl } from '@/store/useMapStore';

/**
 * 손가락으로 **다른 화면의 지도**를 끌고 당긴다.
 *
 * 장소 상세는 자기 지도가 없다. 홈 지도를 반투명하게 비추고 있을 뿐인데, 안드로이드에서는
 * 위에 겹친 화면이 터치를 그대로 삼켜 손가락이 아래 WebView까지 닿지 않는다 —
 * react-native-screens의 `Screen`이 `ReactViewGroup`이고, 그 `onTouchEvent`는 자기 영역 안의
 * 터치를 언제나 받아 버린다(`pointerEvents="box-none"`은 우리 View에만 걸린다).
 *
 * 그래서 **받아서 넘긴다.** 이 훅이 만든 `panHandlers`를 지도가 보이는 자리에 깔면, 그 위에서
 * 일어난 제스처가 `MapGestureControl`을 통해 아래 지도의 명령으로 바뀐다.
 *
 * 한 손가락은 끌기, 두 손가락은 확대다. 지도가 없으면(`control`이 null) 아무것도 하지 않는다.
 */

/**
 * 두 손가락 간격이 이 배수만큼 벌어지면 한 단계 당긴다(모이면 넓힌다).
 *
 * 카카오 축척은 단계로만 움직여서 손가락 간격에 그대로 이어 붙일 수 없다. 한 단계가 거리 2배에
 * 해당하지만 그만큼 벌리기 전에 반응해야 손에 붙은 느낌이 나므로, 절반쯤인 이 값에서 넘긴다.
 */
const PINCH_STEP_RATIO = 1.4;

/**
 * 이 안에서 손을 뗐으면 끈 것이 아니라 **누른 것**으로 본다(px · ms).
 *
 * 마커를 고르는 길이 이것뿐이다 — 이 판이 터치를 먼저 잡으므로 아래 지도의 click은 일어나지
 * 않는다. 손가락은 가만히 누르려 해도 몇 픽셀은 움직이므로 여유를 둔다.
 */
const TAP_SLOP_PX = 8;
const TAP_MAX_MS = 300;

/** 두 손가락 간격. 손가락이 둘보다 적으면 null. */
function spreadOf(event: GestureResponderEvent): number | null {
  const touches = event.nativeEvent.touches;
  if (touches.length < 2) return null;

  const dx = touches[0].pageX - touches[1].pageX;
  const dy = touches[0].pageY - touches[1].pageY;
  return Math.sqrt(dx * dx + dy * dy);
}

export interface MapGestures {
  /** 지도가 보이는 자리를 덮는 View에 펼쳐 넣는다. */
  panHandlers: GestureResponderHandlers;
}

export function useMapGestures(control: MapGestureControl | null): MapGestures {
  /**
   * 직전에 넘긴 누적 이동량.
   *
   * `PanResponder`는 **처음 누른 자리부터의 누적 거리**를 준다. 지도에는 지난 프레임 대비
   * 변화량을 넘겨야 하므로 그 차이를 계산하고 기준을 갱신한다.
   */
  const sent = useRef({ x: 0, y: 0 });
  /** 확대 판정의 기준이 되는 두 손가락 간격. 한 손가락이면 null. */
  const spread = useRef<number | null>(null);
  /**
   * 처음 누른 자리와 시각. 손을 뗄 때 탭인지 가른다.
   *
   * 자리는 화면 왼쪽 위를 0으로 본 값(`pageX`·`pageY`)이다. 지도 WebView도 같은 자리에서
   * 시작하므로(화면 전체를 덮는다) 그대로 지도의 컨테이너 좌표가 된다.
   */
  const down = useRef({ x: 0, y: 0, at: 0 });

  const responder = useMemo(
    () =>
      PanResponder.create({
        // 지도가 없으면 제스처를 잡지 않는다. 잡아 두고 아무것도 안 하면 먹통으로 보인다.
        onStartShouldSetPanResponder: () => control !== null,
        onMoveShouldSetPanResponder: () => control !== null,
        onPanResponderGrant: (event) => {
          sent.current = { x: 0, y: 0 };
          spread.current = spreadOf(event);
          down.current = {
            x: event.nativeEvent.pageX,
            y: event.nativeEvent.pageY,
            at: Date.now(),
          };
        },
        onPanResponderMove: (event, gesture) => {
          if (control === null) return;

          const current = spreadOf(event);

          if (current !== null) {
            /*
              두 손가락. 벌리면 당기고 모으면 넓힌다.

              **끌지는 않는다.** 두 손가락일 때 `dx`는 두 점의 평균이라, 벌리는 동작에서도
              값이 흔들려 지도가 함께 미끄러진다.
            */
            const base = spread.current ?? current;
            if (current > base * PINCH_STEP_RATIO) {
              control.zoomBy(1);
              spread.current = current;
            } else if (current * PINCH_STEP_RATIO < base) {
              control.zoomBy(-1);
              spread.current = current;
            } else {
              spread.current = base;
            }

            // 손가락이 하나로 줄었을 때 그 순간부터 이어 끌도록 기준을 맞춰 둔다.
            sent.current = { x: gesture.dx, y: gesture.dy };
            return;
          }

          spread.current = null;
          const dx = gesture.dx - sent.current.x;
          const dy = gesture.dy - sent.current.y;
          if (dx === 0 && dy === 0) return;

          sent.current = { x: gesture.dx, y: gesture.dy };
          control.dragBy(dx, dy);
        },
        onPanResponderRelease: (_, gesture) => {
          if (control === null) return;

          /*
            거의 움직이지 않고 곧 뗐으면 **누른 것**이다. 누른 자리를 지도에 넘겨 마커 판정을
            맡긴다 — 무엇이 눌렸는지는 마커의 화면 위치를 아는 지도만 알 수 있다.

            이때는 `dragEnd`를 보내지 않는다. 끈 것이 없으니 멈춘 자리를 다시 알릴 이유가 없고,
            그 알림은 홈에서 장소 목록을 다시 받아오는 계기가 된다.
          */
          const still = Math.abs(gesture.dx) <= TAP_SLOP_PX && Math.abs(gesture.dy) <= TAP_SLOP_PX;

          if (still && Date.now() - down.current.at <= TAP_MAX_MS) {
            control.tapAt(down.current.x, down.current.y);
            return;
          }

          // 멈춘 자리를 지도가 알려야 화면 쪽 중심·영역·축척이 실제와 맞는다.
          control.dragEnd();
        },
        onPanResponderTerminate: () => control?.dragEnd(),
      }),
    [control],
  );

  return { panHandlers: responder.panHandlers };
}
