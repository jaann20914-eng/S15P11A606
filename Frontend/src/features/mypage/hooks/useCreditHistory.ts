import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/api/client';
import { getCreditTransactions } from '@/api/user/credits';
import type { CreditTransaction, CreditTransactionsQuery } from '@/types/credit';
import type { CreditEntry, CreditFilter, CreditPeriod } from '@/types/mypage';
import { formatTransactionTime } from '@/utils/datetime';
import { withMinimumDuration } from '@/utils/promise';

export interface CreditHistory {
  /** 지금 잔액. 목록과 같은 원장에서 나온다. */
  balance: number;
  entries: CreditEntry[];
  loading: boolean;
  /** 다음 페이지를 받는 중인지. 첫 조회와 구분해 목록을 비우지 않는다. */
  loadingMore: boolean;
  /** 더 받을 페이지가 있는지. */
  hasMore: boolean;
  /** 실패 문구. 성공하면 null. */
  error: string | null;
  filter: CreditFilter;
  period: CreditPeriod;
  periodOpen: boolean;
  setFilter: (filter: CreditFilter) => void;
  setPeriod: (period: CreditPeriod) => void;
  togglePeriod: () => void;
  /** 다음 페이지를 이어 받는다. 받을 것이 없으면 아무 일도 하지 않는다. */
  loadMore: () => void;
}

/** 오류 코드별 안내. */
const messageByCode: Record<string, string> = {
  INVALID_CREDIT_FILTER: '조회 조건이 올바르지 않아요.',
  INVALID_PAGINATION: '목록을 더 불러오지 못했어요.',
  UNAUTHORIZED: '로그인이 필요해요.',
  CREDIT_TRANSACTIONS_FETCH_FAILED: '크레딧 내역을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.',
};

/** 화면 필터를 쿼리 값으로 바꾼다. 라벨을 바꿔도 쿼리가 조용히 어긋나지 않도록 표로 둔다. */
const typeQuery: Record<CreditFilter, NonNullable<CreditTransactionsQuery['type']>> = {
  ALL: 'all',
  SPENT: 'spent',
  EARNED: 'earned',
};

const periodQuery: Record<CreditPeriod, NonNullable<CreditTransactionsQuery['period']>> = {
  TODAY: 'today',
  WEEK: 'week',
  MONTH: 'month',
};

/**
 * 한 번에 받아오는 개수.
 *
 * 목록이 그리는 단위와 같아야 한다. `FlatList`의 기본 렌더 묶음은 10개라, 받아온 20개가
 * 10개씩 두 번에 나눠 그려지면서 스피너가 끼었다 빠져 건너뛰는 것처럼 보인다.
 */
export const CREDIT_PAGE_SIZE = 20;

/**
 * 첫 조회에서 로딩 표시를 최소한 이만큼 유지한다.
 *
 * 응답이 빠르면 스피너가 스쳐 지나가 어떤 때는 보이고 어떤 때는 안 보인다. 조건을 바꿀 때마다
 * 화면이 다르게 반응하면 눌린 것이 반영됐는지 알기 어렵다.
 *
 * 이어 받기에는 걸지 않는다. 스크롤 중에 늦어지면 그만큼 목록이 멈춘 것처럼 보인다.
 */
const MIN_LOADING_MS = 500;

/**
 * 서버 거래를 화면이 쓰는 모양으로 바꾼다.
 *
 * `flow`는 서버가 주지 않고 `amount`의 부호가 곧 그 값이다. 표시 문구는 `description`을
 * 그대로 쓴다 — 거래 유형을 화면이 해석하면 서버가 유형을 추가할 때마다 화면을 고쳐야 한다.
 */
function toEntry(transaction: CreditTransaction): CreditEntry {
  return {
    entryId: transaction.transactionId,
    title: transaction.description,
    occurredAt: formatTransactionTime(transaction.createdAt),
    amount: transaction.amount,
    flow: transaction.amount >= 0 ? 'EARNED' : 'SPENT',
  };
}

/**
 * 크레딧 내역과 필터.
 *
 * 종류와 기간을 **모두 서버가 걸러 준다.** 커서 페이지네이션이라 받은 목록에서 화면이 걸러
 * 내면 페이지마다 남는 개수가 달라져 목록이 들쭉날쭉해지고, 더 받을 것이 있는지도 알 수 없다.
 * 그래서 조건이 바뀌면 처음부터 다시 받는다.
 *
 * 잔액도 이 응답에서 온다. 목록과 같은 원장에서 나오므로 `/users/me`를 따로 부르지 않는다.
 */
export function useCreditHistory(): CreditHistory {
  const [entries, setEntries] = useState<CreditEntry[]>([]);
  const [balance, setBalance] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilterState] = useState<CreditFilter>('ALL');
  const [period, setPeriodState] = useState<CreditPeriod>('TODAY');
  const [periodOpen, setPeriodOpen] = useState(false);

  /**
   * 지금 유효한 조회의 번호.
   *
   * 조건을 빠르게 바꾸면 앞선 응답이 뒤늦게 도착해 목록을 되돌려 놓는다. 번호가 다르면 버린다.
   */
  const requestId = useRef(0);

  const load = useCallback(
    (next: { filter: CreditFilter; period: CreditPeriod; cursor?: string }) => {
      const id = requestId.current + 1;
      requestId.current = id;

      const more = next.cursor !== undefined;
      if (more) setLoadingMore(true);
      else setLoading(true);
      setError(null);

      const request = getCreditTransactions({
        type: typeQuery[next.filter],
        period: periodQuery[next.period],
        cursor: next.cursor,
        limit: CREDIT_PAGE_SIZE,
      });

      // 첫 조회만 최소 시간을 지킨다. 이어 받기는 늦추지 않는다.
      (more ? request : withMinimumDuration(request, MIN_LOADING_MS))
        .then((page) => {
          if (requestId.current !== id) return;

          const received = page.items.map(toEntry);
          setEntries((current) => (more ? [...current, ...received] : received));
          setBalance(page.balance);
          setCursor(page.nextCursor);
          setLoading(false);
          setLoadingMore(false);
        })
        .catch((cause: unknown) => {
          if (requestId.current !== id) return;

          setLoading(false);
          setLoadingMore(false);
          setError(
            cause instanceof ApiError
              ? (messageByCode[cause.code] ?? cause.message)
              : '크레딧 내역을 불러오지 못했어요',
          );
        });
    },
    [],
  );

  // 조건이 바뀌면 처음부터 다시 받는다.
  useEffect(() => {
    load({ filter, period });
  }, [load, filter, period]);

  const setFilter = useCallback((next: CreditFilter) => setFilterState(next), []);

  const setPeriod = useCallback((next: CreditPeriod) => {
    setPeriodState(next);
    setPeriodOpen(false);
  }, []);

  const loadMore = useCallback(() => {
    // 첫 조회 중이거나 이미 이어 받는 중이면 겹쳐 부르지 않는다.
    if (cursor === null || loading || loadingMore) return;
    load({ filter, period, cursor });
  }, [cursor, loading, loadingMore, load, filter, period]);

  return {
    balance,
    entries,
    loading,
    loadingMore,
    hasMore: cursor !== null,
    error,
    filter,
    period,
    periodOpen,
    setFilter,
    setPeriod,
    togglePeriod: useCallback(() => setPeriodOpen((open) => !open), []),
    loadMore,
  };
}
