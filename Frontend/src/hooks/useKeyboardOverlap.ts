import { useEffect, useState } from 'react';
import { Dimensions, Keyboard, Platform } from 'react-native';
import type { KeyboardEvent, View } from 'react-native';
import type { RefObject } from 'react';

/**
 * 키보드가 이 영역을 **실제로 덮는 높이**(px). 겹치지 않으면 0.
 *
 * `KeyboardAvoidingView`를 쓰지 않는 이유가 있다. 그 컴포넌트는 안드로이드에서 창이 줄어드는
 * 것(`adjustResize`)에 기대는데, 이 앱은 화면 끝까지 그리는 방식(edge-to-edge)이라 창이 줄지
 * 않는다. 키보드가 화면 위를 덮을 뿐이어서 아무것도 밀려 올라가지 않는다.
 *
 * 그렇다고 키보드 높이를 그대로 쓰면 안 된다. 그 값은 **창 맨 아래** 기준이라 탭바처럼 이
 * 영역 밖에 있는 것까지 포함한다. 빼야 할 값을 손으로 계산하면 탭바가 없는 화면, 추천 단어
 * 줄이 생겨 키보드가 커지는 순간, 기기마다 다른 여백에서 어긋난다.
 *
 * 그래서 재서 쓴다 — 이 영역의 아래 끝과 키보드의 윗변을 창 좌표에서 비교하면, 겹치는 만큼이
 * 그대로 나온다. 키보드가 커지면 다시 재므로 따라간다.
 */
/**
 * 창이 줄어드는 것까지 끝나기를 기다리는 시간(ms).
 *
 * 키보드가 뜨는 애니메이션보다 넉넉히 잡는다. 이 시점의 값이 최종값이 된다.
 */
const RESIZE_SETTLE_MS = 250;

export function useKeyboardOverlap(ref: RefObject<View | null>): number {
  const [overlap, setOverlap] = useState(0);

  useEffect(() => {
    /** 예약해 둔 다시 재기. 정리할 때 취소한다. */
    let frame: number | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const measureOnce = (keyboardHeight: number) => {
      const node = ref.current;

      if (node === null) return;

      /*
        **아래에서부터** 잰다.

        키보드 위치(`screenY`)는 화면 기준이고 `measureInWindow`는 창 기준이라, 상태바만큼
        원점이 어긋나 있다. 그 차이가 그대로 오차가 되어 버튼이 조금 가렸다. 둘 다 아래에서
        떨어진 거리로 바꾸면 위쪽 원점 차이가 상쇄된다.

        **창이 이미 줄어든 경우도 이 식이 알아서 받는다.** 그때는 이 영역의 아래 끝이 창
        바닥에 붙어 있어 `gapBelow`가 키보드 높이만큼 되고, 겹침은 0이 된다 — 화면이 스스로
        올라갔으니 우리가 더 올릴 것이 없다.
      */
      const windowHeight = Dimensions.get('window').height;

      node.measureInWindow((_x, y, _width, height) => {
        const gapBelow = windowHeight - (y + height);

        setOverlap(Math.max(0, keyboardHeight - gapBelow));
      });
    };

    /**
     * 키보드 사건 하나에 **여러 번** 잰다.
     *
     * 안드로이드 15부터 화면 끝까지 그리기가 강제되면서, 키보드가 뜰 때 창이 줄어드는 시점과
     * `keyboardDidShow`가 오는 순서가 버전마다 다르다. 한 번만 재면 리사이즈가 나중에 오는
     * 기기에서 옛 좌표로 계산해 버튼이 그대로 가렸다(안드로이드 16, 2026-08-06 제보).
     *
     * 값이 같으면 상태가 바뀌지 않아 다시 그리지도 않으므로, 여러 번 재는 비용은 없다.
     */
    const measure = (event: KeyboardEvent) => {
      const keyboardHeight = event.endCoordinates.height;

      measureOnce(keyboardHeight);

      if (frame !== null) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => measureOnce(keyboardHeight));

      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => measureOnce(keyboardHeight), RESIZE_SETTLE_MS);
    };

    /*
      iOS는 `will`이 애니메이션과 함께 와서 부드럽고, 안드로이드는 `did`만 신뢰할 수 있다.
      키보드가 뜬 뒤에 높이가 바뀌는 경우(추천 단어 줄, 이모지 판)를 위해 프레임 변경도 듣는다.
    */
    const subscriptions = [
      Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', measure),
      Keyboard.addListener('keyboardDidChangeFrame', measure),
      Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () =>
        setOverlap(0),
      ),
    ];

    return () => {
      subscriptions.forEach((subscription) => subscription.remove());
      if (frame !== null) cancelAnimationFrame(frame);
      if (timer !== null) clearTimeout(timer);
    };
  }, [ref]);

  return overlap;
}
