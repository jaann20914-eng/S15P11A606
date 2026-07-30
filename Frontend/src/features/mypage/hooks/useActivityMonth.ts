import { useCallback, useState } from 'react';
import { compareMonth, shiftMonth } from '@/utils/activityCalendar';
import type { YearMonth } from '@/utils/activityCalendar';

export interface ActivityMonthNavigation {
  /** 조회할 연월. 아직 기준을 모르면 `undefined`이고 서버가 현재 서비스 연월을 고른다. */
  month: YearMonth | undefined;
  canGoPrev: boolean;
  canGoNext: boolean;
  prev: () => void;
  next: () => void;
  /**
   * 미래 판정의 기준이 될 현재 서비스 연월을 알려 준다.
   *
   * 파라미터 없이 받은 첫 응답의 연월을 그대로 넣는다. 두 번째부터는 무시한다.
   * 서비스 날짜 경계가 Asia/Seoul 오전 4시라 프론트가 직접 계산하면 어긋난다.
   */
  captureServiceMonth: (month: YearMonth) => void;
}

/**
 * 달력의 달 이동.
 *
 * 미래는 볼 수 없다. 과거는 제한하지 않고 계속 넘길 수 있으며, 활동이 없는 달은 회색 칸과
 * 0으로 보인다. 갈 수 없는 방향은 화살표를 연하게 만들어 누르기 전에 알 수 있다.
 */
export function useActivityMonth(): ActivityMonthNavigation {
  const [month, setMonth] = useState<YearMonth | undefined>(undefined);
  const [serviceMonth, setServiceMonth] = useState<YearMonth | null>(null);

  const captureServiceMonth = useCallback((loaded: YearMonth) => {
    // 첫 응답만 기준으로 삼는다. 달을 옮긴 뒤 응답이 와도 기준은 그대로다.
    setServiceMonth((current) => current ?? loaded);
  }, []);

  const current = month ?? serviceMonth;

  const prev = useCallback(() => {
    setMonth((selected) => {
      const base = selected ?? serviceMonth;
      return base ? shiftMonth(base, -1) : selected;
    });
  }, [serviceMonth]);

  const next = useCallback(() => {
    setMonth((selected) => {
      const base = selected ?? serviceMonth;
      return base ? shiftMonth(base, 1) : selected;
    });
  }, [serviceMonth]);

  // 기준을 아직 모르면 이동을 열지 않는다. 첫 응답이 오면 열린다.
  const ready = current !== null && serviceMonth !== null;

  return {
    month,
    // 과거는 제한하지 않는다. 활동이 없는 달은 회색 칸과 0으로 보인다.
    canGoPrev: ready,
    canGoNext: ready && compareMonth(current, serviceMonth) < 0,
    prev,
    next,
    captureServiceMonth,
  };
}
