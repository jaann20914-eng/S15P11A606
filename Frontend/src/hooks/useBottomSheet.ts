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
 * 감쇠비 ζ = damping / (2·√(stiffness·mass)) ≈ 0.62 로 **덜 감쇠**된 값이다.
 * 목표 지점을 조금 지나쳤다가 되돌아오며 멈춰 쫀득하게 붙는 느낌을 낸다.
 * 1에 가까울수록 딱 멈춰 딱딱하고, 너무 낮추면 출렁여서 값을 읽기 어려워진다.
 *
 * `stiffness`를 올린 것은 도착이 늦으면 그 자체가 "끊긴다"로 읽히기 때문이다 —
 * 빨리 도착해서 한 번 튕기는 편이 천천히 스며드는 것보다 매끄럽게 느껴진다.
 *
 * 멈춤 판정을 기본값(0.001)보다 크게 둔다. 눈에 보이지 않는 진폭까지 따라가면 애니메이션이
 * 필요 이상으로 오래 살아 있어, 그동안 들어온 다음 조작과 겹친다.
 */
const SPRING = {
  damping: 17,
  stiffness: 210,
  mass: 0.9,
  restDisplacementThreshold: 0.4,
  restSpeedThreshold: 0.4,
} as const;

/**
 * 손을 떼는 순간의 속도를 얼마나 멀리 내다볼지(ms).
 *
 * 이 값이 없으면 천천히 끌다 튕겨도 가장 가까운 단계로만 가서 둔하게 느껴진다.
 */
const FLICK_PROJECTION_MS = 90;

/**
 * 제스처 속도(px/ms)를 스프링 속도(px/s)로 바꾸는 값.
 *
 * `PanResponder`의 `vy`는 **밀리초당** 픽셀이고, RN 스프링은 적분 간격을 초로 잡아
 * **초당** 픽셀을 기대한다. 그대로 넘기면 1000분의 1로 줄어 사실상 정지 상태에서
 * 출발하는 셈이 된다.
 */
const VELOCITY_PER_SECOND = 1000;

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
  /**
   * 단계를 옮긴다. 스프링으로 이어서 움직인다.
   *
   * `velocity`(px/ms)를 주면 그 속도로 출발한다. 드래그를 놓는 순간의 속도를 그대로 넘기면
   * 손가락이 하던 움직임이 스프링으로 이어져 끊긴 느낌이 없어진다.
   */
  moveTo: (next: SheetLevel, velocity?: number) => void;
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

  /** 스프링이 도는 중인지. 측정값 보정이 진행 중인 움직임을 덮지 않도록 본다. */
  const settling = useRef(false);
  /** 손가락이 시트를 잡고 있는지. 잡고 있는 동안은 어떤 보정도 끼어들지 않는다. */
  const dragging = useRef(false);

  /*
    지금 시트가 실제로 놓인 y좌표.

    **네이티브 드라이버로 도는 동안 JS 쪽 값은 갱신되지 않는다.** 애니메이션이 네이티브에서만
    돌기 때문이다. 그래서 `stopAnimation`의 콜백으로 현재 값을 물어도 애니메이션 시작 전의
    값이 올 수 있다. 리스너를 붙이면 RN이 네이티브 값을 JS로 흘려보내므로 그것을 받아 둔다.

    시트 하나에 값 하나라 프레임마다 오는 비용은 문제가 되지 않는다.
  */
  const currentY = useRef(snapPoints[1]);
  useEffect(() => {
    const id = sheetY.addListener(({ value }) => {
      currentY.current = value;
    });
    return () => sheetY.removeListener(id);
  }, [sheetY]);

  const moveTo = useCallback(
    (next: SheetLevel, velocity = 0) => {
      setLevel(next);
      settling.current = true;

      Animated.spring(sheetY, {
        toValue: snapPoints[next],
        velocity: velocity * VELOCITY_PER_SECOND,
        useNativeDriver: true,
        ...SPRING,
      }).start(() => {
        settling.current = false;
      });
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

    /*
      **끌고 있는 중이면 아무것도 손대지 않는다.** `dragStart`까지 포함해서다 — 그 값은 드래그
      중에 손가락 위치를 계산하는 기준이라, 여기서 덮으면 시트가 손에서 튀어나간다.
      놓는 순간 어차피 새 스냅 위치로 붙으므로 보정할 것도 없다.
    */
    if (dragging.current) return;

    dragStart.current = snapPoints[level];

    /*
      움직이는 중이면 값을 덮지 않고 **목표만 새 위치로 바꿔** 스프링을 이어 돌린다.

      예전에는 늘 `setValue`로 곧바로 놓았다. 카드 높이 측정은 단계 전환과 거의 동시에
      도착하는 일이 잦은데, 그때마다 도는 중인 스프링을 끊고 순간이동시켜 **전환이 뚝
      끊겨 보였다.** 지금 속도를 알 수 없으므로 0에서 다시 출발하지만, 위치가 이어지는
      것만으로 튀는 느낌은 사라진다.
    */
    if (settling.current) {
      Animated.spring(sheetY, {
        toValue: snapPoints[level],
        useNativeDriver: true,
        ...SPRING,
      }).start(() => {
        settling.current = false;
      });
      return;
    }

    // 멈춰 있을 때의 보정이므로 곧바로 놓는다. 사용자가 시작한 이동이 아니다.
    sheetY.setValue(snapPoints[level]);
  }, [level, sheetY, snapPoints]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 5,
        onPanResponderGrant: () => {
          dragging.current = true;

          /*
            도는 중인 스프링을 세우고 **지금 보이는 자리**에서 이어 잡는다.

            예전에는 단계의 스냅 위치를 잡기만 했다. 전환이 끝나기 전에 다시 손을 대면 시트가
            아직 도착하지 않았는데도 목표 지점을 기준으로 계산해, 잡는 순간 그 차이만큼
            건너뛰었다. 애니메이션을 멈추지 않아 스프링과 손가락이 같은 값을 동시에 쓰기도 했다.
          */
          sheetY.stopAnimation();
          dragStart.current = currentY.current;
          settling.current = false;
        },
        onPanResponderMove: (_, gesture) => {
          // 확장보다 위로는 가지 않는다. 아래쪽 한계는 닫을 수 있는지에 따라 달라진다.
          const lowest = onDismiss ? space : snapPoints[0];
          const next = Math.min(lowest, Math.max(snapPoints[2], dragStart.current + gesture.dy));
          sheetY.setValue(next);
        },
        onPanResponderRelease: (_, gesture) => {
          dragging.current = false;
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

          // 놓는 순간의 속도를 그대로 넘겨 손가락의 움직임이 스프링으로 이어지게 한다.
          moveTo(nearest, gesture.vy);
        },
        /*
          손가락이 아니라 시스템이 제스처를 가져가는 경우(전화 수신, 다른 뷰가 낚아챔)다.
          플래그를 남겨 두면 이후 보정이 영원히 건너뛰어지므로 여기서도 반드시 내린다.
        */
        onPanResponderTerminate: () => {
          dragging.current = false;
          moveTo(level);
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
