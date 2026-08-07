import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/api/client';
import { getMyCategories, updateMyProfile } from '@/api/user/profileUpdate';
import { MAX_PREFERENCES, type PreferenceCategoryCode } from '@/constants/categories';

export interface ProfileEditState {
  /** 지금 고른 관심 카테고리. **고른 순서가 곧 순위**라 정렬하지 않는다. */
  categories: PreferenceCategoryCode[];
  /** 기존 선택을 받아 오는 중. 받기 전에는 카드를 눌러도 곧 덮이므로 잠근다. */
  loading: boolean;
  /** 카드 하나를 켜고 끈다. 상한에 닿으면 새로 켜지지 않는다. */
  toggleCategory: (code: PreferenceCategoryCode) => void;
  saving: boolean;
  /** 저장 실패 문구. 성공하면 null. */
  error: string | null;
  /** 닉네임과 카테고리를 함께 저장한다. 성공하면 저장된 닉네임, 실패하면 null. */
  save: (nickname: string) => Promise<string | null>;
  dismissError: () => void;
}

/** 오류 코드별 안내. 사용자가 다음에 할 일이 서로 다르다. */
const messageByCode: Record<string, string> = {
  INVALID_NICKNAME: '닉네임 형식을 다시 확인해 주세요.',
  NICKNAME_ALREADY_EXISTS: '방금 다른 분이 먼저 사용했어요. 다른 닉네임을 골라 주세요.',
  INVALID_CATEGORY_PREFERENCE: `관심 장소는 1~${MAX_PREFERENCES}개까지 고를 수 있어요.`,
  INVALID_REQUEST: '입력한 내용을 다시 확인해 주세요.',
  UNAUTHORIZED: '다시 로그인한 뒤 시도해 주세요.',
  NICKNAME_UPDATE_FAILED: '저장하지 못했어요. 잠시 후 다시 시도해 주세요.',
  CATEGORY_PREFERENCE_UPDATE_FAILED: '저장하지 못했어요. 잠시 후 다시 시도해 주세요.',
};

/**
 * 마이페이지 "나의 정보" 수정.
 *
 * 닉네임과 관심 카테고리를 **한 번에** 저장한다(`PATCH /users/me`). 서버가 한 트랜잭션으로
 * 처리해 하나라도 어긋나면 전부 되돌리므로, 화면도 저장 버튼 하나로 묶는 것이 맞다.
 *
 * 기존 선택은 프로필 응답에 없어 따로 받아 온다(`GET /users/me/categories`). 못 받으면 빈
 * 채로 시작한다 — 조회 실패로 수정 자체를 막으면 다른 API의 장애가 이 화면까지 번진다.
 */
export function useProfileEdit(): ProfileEditState {
  const [categories, setCategories] = useState<PreferenceCategoryCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** 저장이 겹치지 않게 한다. 버튼을 잠그지만 연타는 그 사이에도 들어온다. */
  const inFlight = useRef(false);

  useEffect(() => {
    let alive = true;

    getMyCategories()
      .then((result) => {
        if (alive) setCategories(result.preferredCategories);
      })
      .catch(() => undefined)
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const toggleCategory = useCallback((code: PreferenceCategoryCode) => {
    setCategories((current) => {
      if (current.includes(code)) return current.filter((value) => value !== code);

      // 상한에 닿으면 그대로 둔다. 먼저 고른 것을 밀어내면 순위가 조용히 바뀐다.
      return current.length < MAX_PREFERENCES ? [...current, code] : current;
    });
  }, []);

  const save = useCallback(
    async (nickname: string): Promise<string | null> => {
      if (inFlight.current) return null;

      inFlight.current = true;
      setSaving(true);
      setError(null);

      try {
        const saved = await updateMyProfile(nickname, categories);

        setCategories(saved.preferredCategories);
        return saved.nickname;
      } catch (cause: unknown) {
        const code = cause instanceof ApiError ? cause.code : null;

        setError(
          code !== null
            ? (messageByCode[code] ?? (cause as ApiError).message)
            : '저장하지 못했어요. 잠시 후 다시 시도해 주세요.',
        );
        return null;
      } finally {
        inFlight.current = false;
        setSaving(false);
      }
    },
    [categories],
  );

  return {
    categories,
    loading,
    toggleCategory,
    saving,
    error,
    save,
    dismissError: useCallback(() => setError(null), []),
  };
}
