import { useEffect, useRef, useState } from 'react';

/**
 * 흐림이 거쳐 가는 단계.
 *
 * 값 하나하나가 한 번의 그리기다. 촘촘할수록 부드럽지만 그만큼 자주 다시 그린다. 다섯 단계면
 * 눈에는 이어져 보이고 비용도 크지 않다.
 */
const STEPS = [0, 6, 14, 24, 32];

/** 단계 사이 간격(ms). 전체로는 약 90ms 걸린다 — 시트가 오르내리는 시간과 비슷하다. */
const STEP_MS = 22;

/**
 * 뒤 화면에 거는 흐림의 반경.
 *
 * **값이 0이어도 항상 흐림을 걸어 둔다.** 필터를 켰다 끄면 그 순간 안드로이드가 해당 뷰를
 * 오프스크린 버퍼로 올리거나 내리는데, 영상이 `textureView`로 그려지는 이 화면에서는 그
 * 프레임에 흰 화면이 스친다. 필터가 늘 걸려 있으면 레이어 방식이 바뀌지 않아 깜빡임이 없다.
 *
 * 값은 단계별로 올리고 내린다. 한 번에 0에서 32로 뛰면 흐림이 튀어 보이고, 시트는 움직이는
 * 중인데 배경만 먼저 도착한 것처럼 어긋난다.
 */
export function useBackdropBlur(active: boolean): number {
  const [index, setIndex] = useState(0);
  const target = active ? STEPS.length - 1 : 0;
  const targetRef = useRef(target);
  targetRef.current = target;

  useEffect(() => {
    if (index === target) return;

    const timer = setTimeout(() => {
      setIndex((current) => {
        const goal = targetRef.current;
        if (current === goal) return current;
        return current < goal ? current + 1 : current - 1;
      });
    }, STEP_MS);

    return () => clearTimeout(timer);
  }, [index, target]);

  return STEPS[index];
}
