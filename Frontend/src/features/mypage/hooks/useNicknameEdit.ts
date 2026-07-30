import { useCallback, useState } from 'react';
import { checkMockNickname } from '@/mocks/mypage';
import { MIN_NICKNAME_LENGTH } from '@/types/mypage';

export interface NicknameEdit {
  nickname: string;
  /** 입력 길이. 안내 문구의 `n / 12`에 쓴다. */
  length: number;
  /** 중복 확인을 통과했는지. 통과해야 저장할 수 있다. */
  checked: boolean;
  checking: boolean;
  /** 이미 쓰는 닉네임일 때의 문구. 문제가 없으면 null. */
  error: string | null;
  /** 중복 확인 버튼을 누를 수 있는지. */
  canCheck: boolean;
  change: (value: string) => void;
  check: () => void;
}

/**
 * 닉네임 수정 입력.
 *
 * 값을 고치면 중복 확인이 풀린다. 확인한 뒤 다른 이름으로 바꿔 놓고 저장하는 것을 막는다.
 */
export function useNicknameEdit(): NicknameEdit {
  const [nickname, setNickname] = useState('');
  const [checked, setChecked] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const change = useCallback((value: string) => {
    setNickname(value);
    setChecked(false);
    setError(null);
  }, []);

  const check = useCallback(() => {
    const value = nickname.trim();
    if (value.length < MIN_NICKNAME_LENGTH) return;

    setChecking(true);
    setError(null);

    checkMockNickname(value)
      .then((available) => {
        setChecking(false);
        setChecked(available);
        if (!available) setError('이미 사용 중인 닉네임이에요.');
      })
      .catch(() => {
        setChecking(false);
        setError('중복을 확인하지 못했어요. 잠시 후 다시 시도해 주세요.');
      });
  }, [nickname]);

  const length = nickname.length;

  return {
    nickname,
    length,
    checked,
    checking,
    error,
    canCheck: length >= MIN_NICKNAME_LENGTH && !checking,
    change,
    check,
  };
}
