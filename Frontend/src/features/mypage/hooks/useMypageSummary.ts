import { useEffect, useState } from 'react';
import { fetchMockMonthlyActivity, fetchMockProfileSummary } from '@/mocks/mypage';
import type { MonthlyActivity, MyProfileSummary } from '@/types/mypage';

export interface MypageSummary {
  summary: MyProfileSummary | null;
  activity: MonthlyActivity | null;
  loading: boolean;
}

/**
 * 마이페이지 첫 화면 데이터.
 *
 * 신뢰도 요약과 이번 달 활동을 함께 불러온다. 아직 API가 없어 목업을 쓰고,
 * 명세가 나오면 이 훅 안에서 `src/api`를 부르도록 바꾼다.
 */
export function useMypageSummary(): MypageSummary {
  const [summary, setSummary] = useState<MyProfileSummary | null>(null);
  const [activity, setActivity] = useState<MonthlyActivity | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    Promise.all([fetchMockProfileSummary(), fetchMockMonthlyActivity()])
      .then(([nextSummary, nextActivity]) => {
        if (!alive) return;
        setSummary(nextSummary);
        setActivity(nextActivity);
        setLoading(false);
      })
      .catch(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  return { summary, activity, loading };
}
