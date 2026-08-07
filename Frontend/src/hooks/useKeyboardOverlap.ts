import { useEffect, useRef, useState } from 'react';
import { Dimensions, Keyboard, Platform } from 'react-native';
import type { KeyboardEvent, View } from 'react-native';
import type { RefObject } from 'react';
import { useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * 키보드가 이 영역을 **실제로 덮는 높이**(px). 겹치지 않으면 0.
 *
 * `KeyboardAvoidingView`를 쓰지 않는 이유가 있다. 그 컴포넌트는 안드로이드에서 창이 줄어드는
 * 것(`adjustResize`)에 기대는데, 이 앱은 화면 끝까지 그리는 방식(edge-to-edge)이라 창이 줄지
 * 않는다. 키보드가 화면 위를 덮을 뿐이어서 아무것도 밀려 올라가지 않는다.
 *
 * 그렇다고 키보드 높이를 그대로 쓰면 안 된다. 그 값은 이 영역 밖에 있는 것(탭바, 안전영역
 * 여백)까지 포함한다. 그래서 이 영역의 아래 끝과 키보드의 윗변을 비교해 겹치는 만큼만 잰다.
 *
 * 무엇을 기준으로 재는지가 이 훅의 역사다. 안드로이드에서 `measureInWindow`의 원점은
 * 창의 맨 위가 아니라 **상태바 아래**에서 시작한다(기기 로그로 확인). 그래서 화면 원점
 * 기준인 키보드 이벤트의 `screenY`와 직접 비교하면 상태바만큼 어긋났고, 그다음에 쓴
 * `Dimensions.get('window').height`는 상태바·내비게이션 바를 뺀 값이라 우연히 맞았지만
 * 안드로이드 15부터 의미가 바뀌었다 — targetSdk 35 이상이면 시스템 바를 더 이상 빼지
 * 않아, 같은 앱이 OS 버전에 따라 다른 높이를 받는다. 그래서 14 이하에서는 맞던 계산이
 * 15부터 내비게이션 바 높이만큼 모자랐고, 버튼이 그만큼 가려졌다.
 *
 * 지금은 안드로이드에서 OS가 해석해 주는 값을 쓰지 않고 **직접 잰 값만** 쓴다.
 * `useSafeAreaFrame`은 실제 뷰를 잰 전체 화면 높이다. 키보드 이벤트의 높이는 내비게이션
 * 바 윗변부터 잰 값이므로(RN 안드로이드 구현), 키보드의 바닥은 화면 기준으로
 * "프레임 높이 − 내비게이션 바 inset"이고, 이를 `measureInWindow`의 원점(상태바 아래)으로
 * 옮기면 상태바 inset을 한 번 더 뺀 값이 된다. 세 값 모두 OS가 버전에 따라 다르게
 * 해석할 여지가 없는 실측치라, 어느 안드로이드 버전에서든 같은 결과가 나온다.
 * iOS는 이 문제가 없어 기존 그대로 창 높이를 쓴다.
 */
/**
 * 창이 줄어드는 것까지 끝나기를 기다리는 시간(ms).
 *
 * 키보드가 뜨는 애니메이션보다 넉넉히 잡는다. 이 시점의 값이 최종값이 된다.
 */
const RESIZE_SETTLE_MS = 250;

/**
 * 계산에 들어간 값을 전부 남긴다. 기기마다 다른 것이 무엇인지 가리기 위한 임시 진단이다.
 *
 * 이 훅의 식은 실측치만 쓰지만, "`measureInWindow`의 원점이 상태바 아래"라는 **가정** 위에
 * 서 있다. 그 가정이 깨지는 기기가 있는지는 밖에서 볼 수 없어, 문제 기기에서 실제 숫자를
 * 받아 맞춰 보는 수밖에 없다(2026-08-07 — 안드로이드 16에서 채팅 입력칸이 조금 가림).
 *
 * `label`은 어느 화면인지 구분하는 이름이다. 원인이 잡히면 이 로그와 label 인자를 지운다.
 */
function logOverlap(label: string, values: Record<string, number>): void {
  if (!__DEV__) return;

  const line = Object.entries(values)
    .map(([key, value]) => `${key}=${Math.round(value)}`)
    .join(' ');

  console.log(`[keyboard:${label}] ${line}`);
}

export function useKeyboardOverlap(ref: RefObject<View | null>, label = 'unknown'): number {
  const [overlap, setOverlap] = useState(0);

  /*
    키보드가 딛고 올라오는 바닥의 위치. 리스너는 한 번만 등록하므로 ref로 최신 값을 넘긴다.

    회전이나 폴더블 전개로 프레임이 바뀌어도 키보드 이벤트가 다시 오기 전에는 계산할 일이
    없으므로, 값이 렌더마다 갱신되는 것으로 충분하다.
  */
  const frame = useSafeAreaFrame();
  const insets = useSafeAreaInsets();
  const androidKeyboardBase = useRef(0);
  androidKeyboardBase.current = frame.height - insets.bottom - insets.top;

  /* 진단 기록에 그대로 싣기 위해 재료 값도 최신으로 들고 있는다(임시). */
  const frameHeight = useRef(0);
  const insetTop = useRef(0);
  const insetBottom = useRef(0);
  frameHeight.current = frame.height;
  insetTop.current = insets.top;
  insetBottom.current = insets.bottom;

  useEffect(() => {
    /** 예약해 둔 다시 재기. 정리할 때 취소한다. */
    let frame: number | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const measureOnce = (keyboardHeight: number) => {
      const node = ref.current;

      if (node === null) return;

      /*
        **아래에서부터** 잰다. `measureInWindow`의 좌표와 키보드 바닥을 같은 원점의
        "아래에서 떨어진 거리"로 바꿔 비교하면 위쪽 원점 차이가 상쇄된다. 안드로이드의
        기준(`androidKeyboardBase`)이 왜 실측치여야 하는지는 파일 머리에 적어 두었다.

        **창이 이미 줄어든 경우도 이 식이 알아서 받는다.** 그때는 이 영역의 아래 끝이 창
        바닥에 붙어 있어 `gapBelow`가 키보드 높이만큼 되고, 겹침은 0이 된다 — 화면이 스스로
        올라갔으니 우리가 더 올릴 것이 없다.
      */
      const keyboardBase =
        Platform.OS === 'android' ? androidKeyboardBase.current : Dimensions.get('window').height;

      node.measureInWindow((_x, y, _width, height) => {
        const gapBelow = keyboardBase - (y + height);
        const next = Math.max(0, keyboardHeight - gapBelow);

        /*
          진단용 기록(임시). 가려짐이 남는 기기에서 어느 항이 어긋나는지 보려면
          `nodeBottom`(= y+height)과 `keyboardBase`를 비교한다. 이 둘이 같으면 겹침이 곧
          키보드 높이가 되고, 그것이 의도한 결과다.
        */
        logOverlap(label, {
          screenH: frameHeight.current,
          insetTop: insetTop.current,
          insetBottom: insetBottom.current,
          keyboardH: keyboardHeight,
          keyboardBase,
          nodeY: y,
          nodeH: height,
          nodeBottom: y + height,
          gapBelow,
          overlap: next,
        });

        setOverlap(next);
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
  }, [ref, label]);

  return overlap;
}
