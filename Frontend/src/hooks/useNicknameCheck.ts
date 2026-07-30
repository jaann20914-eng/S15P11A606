import { useCallback, useRef, useState } from 'react';
import { ApiError } from '@/api/client';
import { getNicknameAvailability } from '@/api/user/nickname';
import {
  MAX_NICKNAME_LENGTH,
  MIN_NICKNAME_LENGTH,
  isValidNickname,
  normalizeNickname,
} from '@/utils/nickname';

export interface NicknameCheck {
  nickname: string;
  /** 입력 길이. 안내 문구의 `n / 12`에 쓴다. */
  length: number;
  /** 중복 확인을 통과했는지. 통과해야 다음으로 넘어갈 수 있다. */
  checked: boolean;
  checking: boolean;
  /** 쓸 수 없는 이유. 문제가 없으면 null. */
  error: string | null;
  /** 중복 확인 버튼을 누를 수 있는지. */
  canCheck: boolean;
  change: (value: string) => void;
  check: () => void;
  /**
   * 확인을 무르고 이유를 보여준다.
   *
   * 저장할 때 서버가 다시 검사해 거절하면 "확인됨"이 사실과 다르다. 확인을 풀어 다시 누르게
   * 한다.
   */
  invalidate: (reason: string) => void;
}

/** 오류 코드별 안내. */
const messageByCode: Record<string, string> = {
  INVALID_NICKNAME: `${MIN_NICKNAME_LENGTH}~${MAX_NICKNAME_LENGTH}자의 한글, 영문, 숫자만 쓸 수 있어요.`,
  UNAUTHORIZED: '로그인이 필요해요.',
  NICKNAME_AVAILABILITY_CHECK_FAILED: '중복을 확인하지 못했어요. 잠시 후 다시 시도해 주세요.',
};

/**
 * 닉네임 입력과 중복 확인.
 *
 * 화면은 이 훅이 준 값으로 입력란과 버튼만 그리고, 검증·확인 해제 판단은 전부 여기서 한다.
 *
 * 지금은 마이페이지 닉네임 수정만 쓴다. 온보딩도 같은 규칙이지만 온보딩 토큰으로 인증하는
 * 별도 명세가 나올 예정이라, 그 API가 정해지면 어느 호출을 쓸지 고르게 열어 둔다.
 *
 * 값을 고치면 중복 확인이 풀린다. 확인한 뒤 다른 이름으로 바꿔 놓고 넘어가는 것을 막는다.
 *
 * 확인을 통과하면 서버가 정규화한 값을 입력란에 되돌려 넣는다. 영문 대소문자를 구분하지
 * 않아 실제로 저장되는 값이 입력한 값과 다를 수 있어, 저장 전에 그 값을 보여준다.
 *
 * @param initial 입력란의 초기값. 마이페이지에서 현재 닉네임을 채워 넣을 때 쓴다.
 */
export function useNicknameCheck(initial = ''): NicknameCheck {
  const [nickname, setNickname] = useState(initial);
  const [checked, setChecked] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 마지막으로 확인을 요청한 값.
   *
   * 응답을 기다리는 동안 입력이 바뀌면 그 응답은 다른 닉네임의 결과다. 그대로 반영하면
   * 확인하지 않은 이름이 "확인됨"이 되므로 버린다.
   */
  const requested = useRef('');

  const change = useCallback((value: string) => {
    setNickname(value);
    setChecked(false);
    setError(null);
    // 기다리는 중인 응답이 있으면 버린다. 지금 값의 결과가 아니다.
    requested.current = '';
    // 버린 응답은 확인 중 표시를 내리지 못한다. 여기서 내려야 버튼이 스피너에 갇히지 않는다.
    setChecking(false);
  }, []);

  const invalidate = useCallback((reason: string) => {
    setChecked(false);
    setError(reason);
  }, []);

  const check = useCallback(() => {
    const value = nickname.trim();

    // 형식이 어긋나면 서버도 중복을 조회하지 않는다. 보내지 않고 그 자리에서 알린다.
    if (!isValidNickname(normalizeNickname(value))) {
      setChecked(false);
      setError(messageByCode.INVALID_NICKNAME);
      return;
    }

    requested.current = value;
    setChecking(true);
    setError(null);

    getNicknameAvailability(value)
      .then((result) => {
        if (requested.current !== value) return;

        setChecking(false);
        setChecked(result.available);

        if (result.available) {
          // 저장될 값을 그대로 보여준다. 영문 대소문자는 정규화돼 입력한 값과 다를 수 있다.
          setNickname(result.nickname);
          requested.current = result.nickname;
          setError(null);
          return;
        }

        setError('이미 사용 중인 닉네임이에요.');
      })
      .catch((cause: unknown) => {
        if (requested.current !== value) return;

        setChecking(false);
        setChecked(false);
        setError(
          cause instanceof ApiError
            ? (messageByCode[cause.code] ?? cause.message)
            : '중복을 확인하지 못했어요. 잠시 후 다시 시도해 주세요.',
        );
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
    invalidate,
  };
}
