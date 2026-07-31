import { useCallback, useState } from 'react';
import { ApiError } from '@/api/client';
import { updateMyNickname } from '@/api/user/nickname';

export interface NicknameSave {
  saving: boolean;
  /** 저장 실패 문구. 성공하거나 아직 누르지 않았으면 null. */
  error: string | null;
  /** 저장한다. 끝나면 저장된 최종 닉네임을 주고, 실패하면 null을 준다. */
  save: (nickname: string) => Promise<string | null>;
}

/** 오류 코드별 안내. */
const messageByCode: Record<string, string> = {
  INVALID_NICKNAME: '쓸 수 없는 닉네임이에요. 다시 입력해 주세요.',
  UNAUTHORIZED: '로그인이 필요해요.',
  NICKNAME_ALREADY_EXISTS: '방금 다른 분이 사용했어요. 다른 닉네임을 입력해 주세요.',
  NICKNAME_UPDATE_FAILED: '닉네임을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.',
};

/**
 * 닉네임 저장.
 *
 * 미리 중복을 확인했더라도 서버가 형식과 중복을 다시 검사한다. 확인과 저장 사이에 다른
 * 사용자가 먼저 쓸 수 있어 `NICKNAME_ALREADY_EXISTS`가 여기서 처음 나올 수 있다. 그때
 * 닉네임은 바뀌지 않으므로 화면을 떠나지 않고 그 자리에서 알린다.
 *
 * 실패를 던지지 않고 `null`로 알린다. 화면은 성공했을 때만 돌아가면 되고, 문구는 `error`가
 * 들고 있다.
 */
export function useNicknameSave(): NicknameSave {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = useCallback(async (nickname: string): Promise<string | null> => {
    setSaving(true);
    setError(null);

    try {
      const result = await updateMyNickname(nickname);
      setSaving(false);
      return result.nickname;
    } catch (cause: unknown) {
      setSaving(false);
      setError(
        cause instanceof ApiError
          ? (messageByCode[cause.code] ?? cause.message)
          : '닉네임을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.',
      );
      return null;
    }
  }, []);

  return { saving, error, save };
}
