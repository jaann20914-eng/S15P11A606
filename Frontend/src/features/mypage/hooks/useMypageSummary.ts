import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '@/api/client';
import { getMyProfile } from '@/api/user/profile';
import type { ActivityMonth, MyProfileResponse } from '@/types/user';

export interface MypageSummary {
  profile: MyProfileResponse | null;
  loading: boolean;
  /** 실패 문구. 성공하면 null. */
  error: string | null;
  reload: () => void;
}

/** 오류 코드별 안내. */
const messageByCode: Record<string, string> = {
  INVALID_YEAR_MONTH: '조회할 수 없는 기간이에요.',
  USER_NOT_FOUND: '사용자 정보를 찾을 수 없어요.',
  USER_PROFILE_FETCH_FAILED: '프로필을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.',
};

/**
 * 마이페이지 프로필과 월간 활동.
 *
 * 연월을 넘기지 않으면 서버가 현재 서비스 연월을 쓴다. 달 이동을 붙일 때 `month`를 넣는다.
 */
export function useMypageSummary(month?: ActivityMonth): MypageSummary {
  const [profile, setProfile] = useState<MyProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** 다시 불러오기 버튼을 누르면 값이 바뀌어 요청을 다시 보낸다. */
  const [reloadCount, setReloadCount] = useState(0);

  const year = month?.year;
  const monthValue = month?.month;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    const target = year !== undefined && monthValue !== undefined ? { year, month: monthValue } : undefined;

    getMyProfile(target)
      .then((found) => {
        if (!alive) return;
        setProfile(found);
        setLoading(false);
      })
      .catch((cause: unknown) => {
        if (!alive) return;

        setLoading(false);
        setError(
          cause instanceof ApiError
            ? (messageByCode[cause.code] ?? cause.message)
            : '프로필을 불러오지 못했어요',
        );
      });

    return () => {
      alive = false;
    };
  }, [year, monthValue, reloadCount]);

  return {
    profile,
    loading,
    error,
    reload: useCallback(() => setReloadCount((count) => count + 1), []),
  };
}
