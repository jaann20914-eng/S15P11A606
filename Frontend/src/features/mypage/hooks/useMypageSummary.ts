import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
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
  UNAUTHORIZED: '로그인이 필요해요.',
  USER_NOT_FOUND: '사용자 정보를 찾을 수 없어요.',
  USER_PROFILE_FETCH_FAILED: '프로필을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.',
};

/** 받아 둔 달을 찾는 키. 연월을 넘기지 않은 첫 조회는 서버가 고른 달이라 따로 둔다. */
function cacheKey(year?: number, month?: number): string {
  return year === undefined || month === undefined ? '서버기본' : `${year}-${month}`;
}

/**
 * 마이페이지 프로필과 월간 활동.
 *
 * 연월을 넘기지 않으면 서버가 현재 서비스 연월을 쓴다. 달 이동을 붙일 때 `month`를 넣는다.
 *
 * **한 번 받아 둔 달은 다시 부르지 않는다.** 달력은 앞뒤로 오가며 보는 화면인데 매번 서버를
 * 부르면 이동마다 로딩이 끼어 넘겨보기가 어렵다. 하루 단위로 바뀌는 값이라 화면에 머무는 동안은
 * 받아 둔 것을 그대로 써도 어긋나지 않는다.
 *
 * 대신 **화면에 다시 들어올 때 비운다**. 그 사이 핀을 올렸거나 크레딧이 오갔을 수 있어,
 * 다시 들어온 순간의 값은 새로 받아야 맞다.
 */
export function useMypageSummary(month?: ActivityMonth): MypageSummary {
  const [profile, setProfile] = useState<MyProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** 다시 불러오기 버튼을 누르면 값이 바뀌어 요청을 다시 보낸다. */
  const [reloadCount, setReloadCount] = useState(0);

  const year = month?.year;
  const monthValue = month?.month;

  /** 이 화면에 머무는 동안 받아 둔 달. 화면을 다시 열면 비운다. */
  const cacheRef = useRef(new Map<string, MyProfileResponse>());

  /**
   * 화면에 다시 들어오면 받아 둔 것을 버리고 지금 보고 있는 달을 새로 받는다.
   *
   * 첫 진입에서는 아래 이펙트가 이미 받아 오므로 건너뜬다. 그러지 않으면 들어올 때마다 같은
   * 요청이 두 번 나간다.
   */
  const firstFocusRef = useRef(true);

  useFocusEffect(
    useCallback(() => {
      if (firstFocusRef.current) {
        firstFocusRef.current = false;
        return;
      }

      cacheRef.current.clear();
      setReloadCount((count) => count + 1);
    }, []),
  );

  useEffect(() => {
    const key = cacheKey(year, monthValue);
    const cached = cacheRef.current.get(key);

    // 받아 둔 달이면 요청 없이 그대로 보여준다. 이동이 즉시 끝난다.
    if (cached !== undefined) {
      setProfile(cached);
      setLoading(false);
      setError(null);
      return;
    }

    let alive = true;
    setLoading(true);
    setError(null);

    const target = year !== undefined && monthValue !== undefined ? { year, month: monthValue } : undefined;

    getMyProfile(target)
      .then((found) => {
        if (!alive) return;

        cacheRef.current.set(key, found);
        /*
          서버가 고른 달로 받은 경우, 그 달의 키로도 넣어 둔다. 달 이동은 이 달을 기준으로
          시작하므로, 옆으로 갔다가 돌아올 때 같은 것을 다시 받지 않게 된다.
        */
        cacheRef.current.set(cacheKey(found.monthlyActivity.year, found.monthlyActivity.month), found);

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
    // 다시 불러오기는 받아 둔 것을 버리고 새로 받는다. 그러지 않으면 같은 값만 다시 보인다.
    reload: useCallback(() => {
      cacheRef.current.clear();
      setReloadCount((count) => count + 1);
    }, []),
  };
}
