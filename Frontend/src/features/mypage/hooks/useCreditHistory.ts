import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchMockCreditEntries } from '@/mocks/mypage';
import type { CreditEntry, CreditFilter, CreditPeriod } from '@/types/mypage';

export interface CreditHistory {
  /** 종류 필터를 적용한 목록. */
  entries: CreditEntry[];
  loading: boolean;
  filter: CreditFilter;
  period: CreditPeriod;
  periodOpen: boolean;
  setFilter: (filter: CreditFilter) => void;
  setPeriod: (period: CreditPeriod) => void;
  togglePeriod: () => void;
}

/**
 * 크레딧 내역과 필터.
 *
 * 기간은 서버가 걸러 주고(쿼리로 보낸다) 종류는 받은 목록에서 걸러 낸다. 종류를 바꿀 때마다
 * 다시 요청하면 같은 데이터를 반복해서 받게 된다.
 */
export function useCreditHistory(): CreditHistory {
  const [all, setAll] = useState<CreditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<CreditFilter>('ALL');
  const [period, setPeriodState] = useState<CreditPeriod>('TODAY');
  const [periodOpen, setPeriodOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);

    fetchMockCreditEntries(period)
      .then((found) => {
        if (!alive) return;
        setAll(found);
        setLoading(false);
      })
      .catch(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [period]);

  const entries = useMemo(
    () => (filter === 'ALL' ? all : all.filter((entry) => entry.flow === filter)),
    [all, filter],
  );

  const setPeriod = useCallback((next: CreditPeriod) => {
    setPeriodState(next);
    setPeriodOpen(false);
  }, []);

  return {
    entries,
    loading,
    filter,
    period,
    periodOpen,
    setFilter,
    setPeriod,
    togglePeriod: useCallback(() => setPeriodOpen((open) => !open), []),
  };
}
