import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, PanResponder } from 'react-native';
import type { GestureResponderHandlers } from 'react-native';

/**
 * 3단계 바텀시트의 움직임.
 *
 * 홈과 장소 상세가 같은 시트를 각자 구현하고 있었다. 스냅 계산과 드래그 처리가 그대로
 * 복사돼 있어 한쪽만 고쳐지는 일이 반복됐다(`DESIGN_GUIDE.md` 9.2가 지적한 중복이다).
 *
 * 높이를 정하는 값은 화면이 재서 넘긴다 — 시트에 무엇이 들어가는지는 화면만 안다.
 * 이 훅은 그 숫자로 스냅 위치를 만들고 드래그와 애니메이션만 맡는다.
 */

/** 0 축소 · 1 기본 · 2 확장. 숫자가 커질수록 크게 열린다. */
export type SheetLevel = 0 | 1 | 2;

/**
 * 스프링 값. 세 시트가 같은 손맛을 갖도록 한곳에 둔다.
 *
 * 감쇠비 ζ = damping / (2·√(stiffness·mass)) ≈ 0.69 로 **살짝 덜 감쇠**된 값이다.
 * 목표 지점을 조금 지나쳤다가 되돌아오며 멈춰 쫀득하게 붙는 느낌을 낸다.
 * 1에 가까울수록 딱 멈춰 딱딱하고, 너무 낮추면 출렁여서 값을 읽기 어려워진다.
 */
const SPRING = { damping: 18, stiffness: 190, mass: 0.9 } as const;

/**
 * 손을 떼는 순간의 속도를 얼마나 멀리 내다볼지(ms).
 *
 * 이 값이 없으면 천천히 끌다 튕겨도 가장 가까운 단계로만 가서 둔하게 느껴진다.
 */
const FLICK_PROJECTION_MS = 90;

/** 축소보다 이만큼 더 끌어내리면 닫는다. 실수로 스쳐서 닫히지 않을 만큼은 둔다. */
const DISMISS_DRAG = 72;

/** 닫으며 화면 밖으로 내려가는 시간(ms). */
const DISMISS_DURATION_MS = 220;

export interface BottomSheetMetrics {
  /** 시트가 놓이는 영역의 높이. 창 높이와 다를 수 있어 화면이 재서 넘긴다. */
  space: number;
  /** 축소 단계에서 보여야 하는 높이. */
  collapsed: number;
  /** 기본 단계에서 축소보다 더 보여야 하는 높이. */
  middleExtra: number;
  /** 확장 단계에서 시트 위쪽이 놓일 y좌표. 검색바 아래 등 화면이 정한다. */
  expandedTop: number;
  /**
   * 축소보다 더 끌어내렸을 때 할 일. 주지 않으면 축소가 하한이 된다.
   *
   * 겹쳐 띄운 시트를 닫는 데 쓴다 — 아래로 밀어 내리면 그 아래 있던 시트로 돌아간다.
   * 홈처럼 그 자리를 지켜야 하는 시트는 넘기지 않아 축소에서 멈춘다.
   */
  onDismiss?: () => void;
}

export interface BottomSheet {
  level: SheetLevel;
  /** 단계를 옮긴다. 스프링으로 이어서 움직인다. */
  moveTo: (next: SheetLevel) => void;
  /** 탭할 때마다 다음 단계로 돌린다. 손잡이에 연결한다. */
  cycle: () => void;
  /** `Animated.View`의 `translateY`에 그대로 넣는다. */
  sheetY: Animated.Value;
  /** 손잡이를 감싼 View에 펼쳐 넣는다. */
  panHandlers: GestureResponderHandlers;
  /** 시트가 가리는 높이. 지도 중심 보정에 쓴다. */
  coveredHeight: number;
  /**
   * 지금 단계에서 시트 위쪽이 놓인 y좌표.
   *
   * 시트는 화면 전체를 덮는 상자를 `translateY`로 내려 쓴다. 그래서 **시트 아래쪽 이만큼이
   * 화면 밖으로 나가 있다.** 안에 든 ScrollView는 그 밖까지 자기 영역으로 알기 때문에,
   * 내용 끝을 화면 안으로 끌어올릴 수 없다 — 마지막 항목이 끝까지 스크롤되지 않는 이유다.
   *
   * 스크롤 내용의 아래 여백에 이 값을 더하면 끝까지 올라온다.
   */
  top: number;
}

export function useBottomSheet({
  space,
  collapsed,
  middleExtra,
  expandedTop,
  onDismiss,
}: BottomSheetMetrics): BottomSheet {
  const [level, setLevel] = useState<SheetLevel>(1);

  /** 시트 위쪽 y좌표 세 개. 작을수록 크게 열린 상태다. */
  const snapPoints = useMemo(() => {
    const collapsedTop = Math.max(0, space - collapsed);
    const middleTop = Math.max(0, space - collapsed - middleExtra);

    return [
      collapsedTop,
      middleTop,
      // 확장이 기본보다 아래로 내려가면 단계 순서가 뒤집혀 드래그 범위가 깨진다.
      Math.min(expandedTop, middleTop - 1),
    ];
  }, [collapsed, expandedTop, middleExtra, space]);

  const sheetY = useRef(new Animated.Value(snapPoints[1])).current;
  const dragStart = useRef(snapPoints[1]);

  const moveTo = useCallback(
    (next: SheetLevel) => {
      setLevel(next);
      Animated.spring(sheetY, { toValue: snapPoints[next], useNativeDriver: true, ...SPRING }).start();
    },
    [snapPoints, sheetY],
  );

  const cycle = useCallback(() => moveTo(((level + 1) % 3) as SheetLevel), [level, moveTo]);

  /*
    측정값이 도착해 스냅 위치가 바뀌면 지금 단계에 맞춰 다시 놓는다.

    이게 없으면 시트가 첫 렌더의 어림값 자리에 머문다 — 단계는 "기본"인데 실제 높이는
    어림값이라 내용이 어중간하게 걸린다. 사용자가 한 번 끌어야 제자리를 찾게 된다.

    단계가 바뀐 것과 구분해야 한다. 단계 변경은 moveTo의 스프링이 맡으므로 여기서 값을
    덮으면 그 애니메이션이 끊긴다. 그래서 스냅 배열 자체가 바뀐 경우에만 적용한다.
  */
  const appliedSnapPoints = useRef(snapPoints);
  useEffect(() => {
    if (appliedSnapPoints.current === snapPoints) return;
    appliedSnapPoints.current = snapPoints;

    // 보정이므로 애니메이션 없이 곧바로 놓는다. 사용자가 시작한 이동이 아니다.
    sheetY.setValue(snapPoints[level]);
    dragStart.current = snapPoints[level];
  }, [level, sheetY, snapPoints]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 5,
        onPanResponderGrant: () => {
          dragStart.current = snapPoints[level];
        },
        onPanResponderMove: (_, gesture) => {
          // 확장보다 위로는 가지 않는다. 아래쪽 한계는 닫을 수 있는지에 따라 달라진다.
          const lowest = onDismiss ? space : snapPoints[0];
          const next = Math.min(lowest, Math.max(snapPoints[2], dragStart.current + gesture.dy));
          sheetY.setValue(next);
        },
        onPanResponderRelease: (_, gesture) => {
          const projected = dragStart.current + gesture.dy + gesture.vy * FLICK_PROJECTION_MS;

          // 축소를 충분히 지나쳐 내렸으면 단계로 되돌리지 않고 그대로 내보낸다.
          if (onDismiss && projected > snapPoints[0] + DISMISS_DRAG) {
            Animated.timing(sheetY, {
              toValue: space,
              duration: DISMISS_DURATION_MS,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }).start(({ finished }) => {
              if (finished) onDismiss();
            });
            return;
          }

          const nearest = snapPoints.reduce(
            (best, point, index) =>
              Math.abs(point - projected) < Math.abs(snapPoints[best] - projected) ? index : best,
            0,
          ) as SheetLevel;
          moveTo(nearest);
        },
      }),
    [level, moveTo, onDismiss, snapPoints, sheetY, space],
  );

  return {
    level,
    moveTo,
    cycle,
    sheetY,
    panHandlers: panResponder.panHandlers,
    coveredHeight: Math.max(0, space - snapPoints[level]),
    top: snapPoints[level],
  };
}
