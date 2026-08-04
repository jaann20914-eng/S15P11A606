import { Children, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Animated, PanResponder, StyleSheet, View } from 'react-native';
import { spacing } from '@/constants/theme';

/**
 * 카드를 한 장씩 위아래로 넘겨 보는 칸.
 *
 * 바텀시트의 **"보통" 단계**에서 쓴다. 그 단계는 높이가 "카드 한 장"으로 잡혀 있어 목록을
 * 훑는 자리가 아니다. 스크롤로 두면 카드가 반쯤 걸친 채 멈춰 어느 쪽도 제대로 보이지 않으므로,
 * 한 장씩 확 넘어가게 한다. 끝까지 올린 "확장" 단계는 훑는 자리라 `paging`을 꺼서 목록으로 둔다.
 *
 * 카드를 좌우가 아니라 **위아래로** 넘긴다. 시트가 위아래로 열리는 화면이라 같은 축이어야
 * 손이 헷갈리지 않는다.
 *
 * 스크롤뷰를 쓰지 않는다. 이것을 쓰는 화면들은 이미 시트 전체가 스크롤뷰 안에 있어서, 안에 또
 * 하나를 두면 안드로이드에서 두 스크롤이 제스처를 두고 다툰다. 대신 시트와 같은 방식으로
 * (`PanResponder` + `Animated`) 직접 잡는다.
 *
 * 홈 시트와 장소 상세가 함께 쓴다. 손맛이 갈리지 않게 제스처는 여기 한 벌만 둔다
 * (`useBottomSheet`을 한곳에 모은 것과 같은 이유다).
 */

/** 이만큼 끌면 다음 카드로 넘긴다. */
const SWIPE_DISTANCE = 44;

/** 짧게 튕겼을 때 거리 대신 보는 속도(px/ms). 조금만 끌어도 세게 튕기면 넘어간다. */
const FLICK_VELOCITY = 0.3;

/** 첫 카드 위·마지막 카드 아래로 끌 때 따라오는 비율. 끝이라는 것을 손으로 알려 준다. */
const EDGE_RESISTANCE = 0.28;

/**
 * 제스처 속도(px/ms)를 스프링 속도(px/s)로 바꾸는 값.
 *
 * `PanResponder`의 `vy`는 밀리초당 픽셀이고 RN 스프링은 초당 픽셀을 기대한다. 그대로 넘기면
 * 1000분의 1로 줄어 정지 상태에서 출발하는 셈이 된다(`useBottomSheet`도 같은 이유로 변환한다).
 */
const VELOCITY_PER_SECOND = 1000;

/**
 * 카드가 자리를 잡는 스프링.
 *
 * 시트(`useBottomSheet`)보다 단단하게 잡았다 — 시트는 화면 절반이 움직이지만 이쪽은 카드 한
 * 장이라, 같은 값을 쓰면 움직이는 거리가 짧아 물컹하게만 느껴진다.
 */
const SPRING = {
  damping: 22,
  stiffness: 260,
  mass: 0.9,
  restDisplacementThreshold: 0.4,
  restSpeedThreshold: 0.4,
} as const;

/**
 * 카드 높이를 재기 전에 쓰는 어림값.
 *
 * 0으로 시작하지 않는 이유는 이 칸의 높이로 시트의 "보통" 단계 높이를 정하는 화면이 있어서다
 * (`onSlotHeightChange`). 0이면 시트가 한 번 접혔다 펴진다.
 */
const ESTIMATED_CARD_HEIGHT = 240;

/**
 * 카드 사이 간격.
 *
 * 예전에는 칸 높이를 카드 높이와 똑같이 잡아, 넘기는 도중 두 카드가 **맞붙어 보였다** — 홈
 * 카드는 그림자까지 있어 아래 카드에 겹쳐 얹혔다. 칸을 카드보다 이만큼 크게 잡아 늘 이 간격이
 * 사이에 들어가게 한다.
 *
 * 목록(확장 단계)의 카드 사이 간격과 같은 값이다. 같은 카드가 단계에 따라 다른 간격으로
 * 놓이면 넘길 때와 훑을 때의 리듬이 달라진다.
 */
const SLOT_GAP = spacing.x3;

/**
 * 창 좌우에 남기는 그림자 자리.
 *
 * 창은 넘긴 카드를 잘라내려고 `overflow: 'hidden'`을 쓰는데, RN에는 세로만 자르는 수단이
 * 없어 **좌우까지 함께 잘린다.** 카드가 창 폭을 꽉 채우고 있어 그림자가 나갈 자리가 없었고,
 * 위아래 그림자는 보이는데 좌우만 잘려 보였다.
 *
 * 그래서 창을 좌우로 이만큼 넓히고(`marginHorizontal`) 그만큼을 칸이 되돌려 준다
 * (`paddingHorizontal`). 카드 폭은 그대로면서 잘리는 경계만 밖으로 밀려난다.
 *
 * 화면 좌우 여백(가장 좁은 화면에서 18)보다 작아야 창이 화면 밖으로 나가지 않는다.
 */
const SHADOW_ROOM = spacing.x4;

export interface CardPagerProps {
  /** 넘겨 볼 카드들. 각자 `key`를 가져야 한다. */
  children: ReactNode;
  /**
   * 한 장씩 넘길지. 기본은 넘긴다.
   *
   * 끄면 아무것도 감싸지 않고 카드를 그대로 내놓는다 — 감싸는 상자를 두면 그 바깥
   * `contentContainerStyle`의 `gap`이 카드 사이에 먹지 않기 때문이다.
   */
  paging?: boolean;
  /**
   * 칸 높이가 정해질 때마다 알린다.
   *
   * 시트의 "보통" 단계 높이를 이 값으로 정하는 화면이 쓴다. 카드를 직접 재던 화면은 이것으로
   * 바꿔야 한다 — 카드가 칸에 갇히면 잰 값이 칸 높이가 되어 서로 물린다.
   */
  onSlotHeightChange?: (height: number) => void;
  /**
   * 밖에서 고른 카드. 바뀌면 그 카드로 넘어간다.
   *
   * 지도에서 장소를 고르거나, 목록(확장)에서 카드를 눌러 "보통" 단계로 내려오는 경우다. 이게
   * 없으면 넘기는 칸이 늘 첫 카드에서 시작해, 방금 고른 카드가 아닌 것이 보인다.
   *
   * 범위를 벗어난 값(찾지 못해 `-1` 등)은 무시한다. **손으로 넘긴 것은 덮지 않는다** —
   * 이 값이 실제로 바뀔 때만 움직인다.
   */
  activeIndex?: number;
  /**
   * 보고 있는 카드가 바뀔 때마다 알린다.
   *
   * 손으로 넘긴 경우와 `activeIndex`로 옮겨진 경우를 모두 알린다 — 받는 쪽은 "지금 몇 번째"만
   * 알면 되고 누가 옮겼는지는 구분할 필요가 없다.
   */
  onIndexChange?: (index: number) => void;
}

export function CardPager({
  children,
  paging = true,
  onSlotHeightChange,
  activeIndex,
  onIndexChange,
}: CardPagerProps) {
  // `toArray`는 null·false를 걸러 주고 key를 지켜 준다. 측정용으로 한 번 더 그려도 안전하다.
  const items = useMemo(() => Children.toArray(children), [children]);
  const count = items.length;

  const [index, setIndex] = useState(0);

  /*
    카드마다 제 높이가 다를 수 있다 — 글줄 수나 화면 너비에 따라 달라진다. 그런데 한 장씩
    넘기려면 **칸 높이가 모두 같아야** 한다(넘길 거리가 곧 칸 높이다). 그래서 가장 큰 카드에
    맞춰 칸을 잡는다. 짧은 카드는 아래에 여백이 남지만, 넘길 때마다 시트 높이가 들썩이는 것
    보다는 낫다.

    빈 칸이 없는 배열로만 다룬다. `next[i] = height`로 채우면 아직 안 온 자리가 **구멍**으로
    남는데, `every`는 구멍을 건너뛰어 절반만 재고도 다 됐다고 답한다. 그러면 `Math.max`가
    `NaN`을 내고 칸 높이가 무너진다.
  */
  const [heights, setHeights] = useState<readonly number[]>([]);
  const measured = count > 0 && heights.length === count && heights.every((height) => height > 0);

  const reportHeight = useCallback(
    (at: number, height: number) => {
      setHeights((current) => {
        if (current.length === count && current[at] === height) return current;
        return Array.from({ length: count }, (_, position) =>
          position === at ? height : (current[position] ?? 0),
        );
      });
    },
    [count],
  );

  /*
    칸 높이는 **잰 값으로만 올린다.** 어림값으로 되돌리지 않는다.

    카드 수가 바뀌면(홈의 혼잡도 필터가 목록을 걸러낸다) 다시 재야 하는데, 그때 어림값으로
    떨어지면 칸 높이가 한 번 튀고 그 값으로 시트 높이가 정해져 시트까지 들썩인다. 다시 잴
    동안에는 직전 값을 그대로 쓴다.
  */
  const [cardHeight, setCardHeight] = useState(ESTIMATED_CARD_HEIGHT);
  useEffect(() => {
    if (!measured) return;
    setCardHeight(Math.max(...heights));
  }, [heights, measured]);

  /*
    한 칸의 높이 = 가장 큰 카드 + 사이 간격.

    카드는 칸 맨 위에 놓이므로 남는 간격이 아래에 붙는다. 넘길 거리가 이 값이라, 카드와 카드
    사이에는 늘 `SLOT_GAP`이 들어간다 — 맞붙거나 그림자가 겹칠 수 없다.

    창 높이도 같은 값이다. 그러면 다음 카드의 윗변이 창 아래끝에 정확히 걸려 밖에서 기다리므로
    쉬는 동안에는 한 장만 보이고, 그 간격만큼은 카드 그림자가 잘리지 않고 퍼질 자리가 된다.
  */
  const slotHeight = cardHeight + SLOT_GAP;

  /*
    값이 실제로 바뀔 때만 알린다.

    호출부가 리렌더마다 새로 만든 함수를 넘기면 이 효과가 매번 다시 돌고, 그 함수가 상태를
    바꾸면 렌더가 끝나지 않는다. 바뀐 것이 없으면 부르지 않으므로 어떤 함수를 넘겨도 안전하다.
  */
  const reportedSlotHeight = useRef(0);
  useEffect(() => {
    if (reportedSlotHeight.current === slotHeight) return;
    reportedSlotHeight.current = slotHeight;
    onSlotHeightChange?.(slotHeight);
  }, [onSlotHeightChange, slotHeight]);

  const translateY = useRef(new Animated.Value(0)).current;

  const settleTo = useCallback(
    (next: number, velocity: number) => {
      setIndex(next);
      Animated.spring(translateY, {
        toValue: -next * slotHeight,
        velocity: velocity * VELOCITY_PER_SECOND,
        useNativeDriver: true,
        ...SPRING,
      }).start();
    },
    [slotHeight, translateY],
  );

  /*
    칸 높이가 바뀌면(측정이 도착하거나 화면이 회전하면) 지금 카드 자리도 그만큼 달라진다.

    카드를 넘긴 것과 구분해야 한다 — 그쪽은 위 스프링이 맡으므로 여기서 값을 덮으면 그
    애니메이션이 끊긴다. 그래서 칸 높이 자체가 바뀐 경우에만 다시 놓는다.
  */
  /*
    보고 있는 카드가 바뀐 것을 알린다.

    값이 실제로 바뀔 때만 부른다 — 리렌더마다 부르면 받는 쪽이 지도를 계속 다시 옮긴다.
    `activeIndex`로 옮겨진 경우도 여기서 함께 알려지므로 호출부가 두 길을 따로 다룰 필요가 없다.
  */
  const reportedIndex = useRef(index);
  useEffect(() => {
    if (reportedIndex.current === index) return;
    reportedIndex.current = index;
    onIndexChange?.(index);
  }, [index, onIndexChange]);

  const appliedSlotHeight = useRef(slotHeight);
  useEffect(() => {
    if (appliedSlotHeight.current === slotHeight) return;
    appliedSlotHeight.current = slotHeight;
    translateY.setValue(-index * slotHeight);
  }, [index, slotHeight, translateY]);

  /*
    카드가 줄어들어 보고 있던 자리가 없어지면 마지막 카드로 당긴다.

    홈에서 혼잡도 필터를 바꾸면 목록이 걸러진다. 이게 없으면 빈 자리를 보고 있게 되어 칸이
    비어 보인다.
  */
  useEffect(() => {
    const last = Math.max(count - 1, 0);
    if (index <= last) return;
    setIndex(last);
    translateY.setValue(-last * slotHeight);
  }, [count, index, slotHeight, translateY]);

  /*
    밖에서 고른 카드로 넘어간다.

    **그 값이 바뀔 때만** 움직인다. 매번 맞추려 들면 손으로 넘긴 것을 곧바로 되돌려 버린다.
  */
  const appliedActiveIndex = useRef(activeIndex);
  useEffect(() => {
    if (activeIndex === undefined || activeIndex === appliedActiveIndex.current) return;
    appliedActiveIndex.current = activeIndex;
    if (activeIndex < 0 || activeIndex > count - 1) return;
    settleTo(activeIndex, 0);
  }, [activeIndex, count, settleTo]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        /*
          움직였을 때만 잡는다. 누르는 순간 잡으면 카드 탭이 죽는다 — 탭은 카드 안쪽
          `Pressable`이 받아야 한다.

          세로로 더 많이 움직였을 때만 잡아, 카드 안에서 가로로 쓸어 넘기는 동작이 생겨도
          서로 빼앗지 않는다. 카드가 한 장뿐이면 넘길 곳이 없으니 잡지 않는다.
        */
        onMoveShouldSetPanResponder: (_, gesture) =>
          count > 1 && Math.abs(gesture.dy) > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        // 한 번 잡으면 놓을 때까지 넘기지 않는다. 끌던 카드가 손에서 빠지는 것을 막는다.
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_, gesture) => {
          const resting = -index * slotHeight;
          const lowest = -(count - 1) * slotHeight;
          const dragged = resting + gesture.dy;

          // 양 끝을 넘어가면 손을 덜 따라간다. 더 없다는 것이 손으로 읽힌다.
          if (dragged > 0) {
            translateY.setValue(gesture.dy * EDGE_RESISTANCE);
            return;
          }
          if (dragged < lowest) {
            translateY.setValue(lowest + (dragged - lowest) * EDGE_RESISTANCE);
            return;
          }
          translateY.setValue(dragged);
        },
        onPanResponderRelease: (_, gesture) => {
          const flicked = Math.abs(gesture.vy) > FLICK_VELOCITY;
          const farEnough = Math.abs(gesture.dy) > SWIPE_DISTANCE;

          // 위로 끌면 다음 카드가 올라온다. 어느 쪽도 아니면 제자리로 돌아간다.
          const wanted = flicked || farEnough ? index + (gesture.dy < 0 ? 1 : -1) : index;

          settleTo(Math.min(Math.max(wanted, 0), count - 1), gesture.vy);
        },
        // 시스템이 제스처를 가져가면 지금 카드 자리로 되돌린다.
        onPanResponderTerminate: () => settleTo(index, 0),
      }),
    [count, index, settleTo, slotHeight, translateY],
  );

  if (count === 0) return null;

  /*
    **두 모드가 같은 뼈대를 쓴다.**

    예전에는 넘기지 않을 때 감싸지 않고 카드를 그대로 내놓았다(`<>{items}</>`). 그러면 단계가
    바뀌는 순간 트리 모양이 달라져 **카드가 전부 언마운트되고 다시 마운트된다.** 시트가
    스프링으로 움직이는 그 프레임에 카드 수만큼의 뷰를 새로 만드니 JS가 붙잡히고, 내용물이
    툭툭 끊겨 보였다. 상자와 칸을 늘 두고 **스타일만 바꾸면** 카드는 그대로 살아 있다.

    대신 목록 모드에서는 사이 간격을 직접 준다. 감싸는 상자가 하나뿐이라 바깥
    `contentContainerStyle`의 `gap`이 카드 사이에 먹지 않기 때문이다. 넘길 때 쓰는 간격과
    같은 값이라 두 단계의 리듬이 맞는다.
  */
  return (
    <View
      {...(paging ? panResponder.panHandlers : null)}
      style={paging ? [s.viewport, { height: slotHeight }] : undefined}
    >
      <Animated.View style={paging ? { transform: [{ translateY }] } : undefined}>
        {items.map((item, at) => (
          <View
            key={`slot-${at}`}
            style={paging ? [s.slot, { height: slotHeight }] : at > 0 ? s.listGap : undefined}
          >
            {item}
          </View>
        ))}
      </Animated.View>

      {/*
        높이 측정 전용. 재고 나면 떼어 낸다.

        **위 카드들을 그대로 재면 안 된다** — 칸에 갇혀 있어 잘린 높이가 나온다(같은 실수로
        요일별 혼잡도 그래프가 아예 보이지 않은 적이 있다). 절대 배치는 흐름 밖이라 칸 높이에
        묶이지 않고 제 높이로 눕는다. 그리지 않고 누르지도 못하게 두므로 화면에는 영향이 없다.
      */}
      {!measured && (
        <View aria-hidden pointerEvents="none" style={s.probe}>
          {items.map((item, at) => (
            <View
              key={`probe-${at}`}
              onLayout={(event) => reportHeight(at, Math.round(event.nativeEvent.layout.height))}
            >
              {item}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  /**
   * 한 장만 보이는 창. 나머지 카드는 이 밖으로 나가 잘린다.
   *
   * 좌우로 `SHADOW_ROOM`만큼 넓혀 카드 그림자가 잘리지 않게 한다. **창에는 여백을 두지
   * 않는다** — 여백을 두면 절대 배치인 `probe`의 기준 폭이 여백을 포함하는지가 플랫폼 구현에
   * 달려 애매해진다. 되돌리는 몫은 칸과 `probe`가 각자 갖는다.
   */
  viewport: { overflow: 'hidden', marginHorizontal: -SHADOW_ROOM },
  /** 넓힌 창을 되돌려 카드 폭을 원래대로 맞춘다. */
  slot: { paddingHorizontal: SHADOW_ROOM },
  /** 목록 모드의 카드 사이 간격. 넘길 때 칸에 들어가는 간격과 같은 값이다. */
  listGap: { marginTop: SLOT_GAP },
  /**
   * 높이를 재는 자리. 칸과 **같은 좌우 여백**을 가져야 한다.
   *
   * 폭이 다르면 글줄이 다르게 접혀 잰 높이가 실제 카드와 어긋난다 — 칸이 그만큼 짧아져
   * 카드 아래가 잘린다.
   */
  probe: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    opacity: 0,
    paddingHorizontal: SHADOW_ROOM,
  },
});
