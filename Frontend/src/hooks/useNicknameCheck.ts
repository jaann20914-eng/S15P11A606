import { useCallback, useRef, useState } from 'react';
import { ApiError } from '@/api/client';
import { getNicknameAvailability } from '@/api/user/nickname';
import { NICKNAME_MAX_LENGTH, NICKNAME_MIN_LENGTH } from '@/constants/onboarding';
import { isValidNickname, normalizeNickname } from '@/utils/nickname';

export interface NicknameCheck {
  nickname: string;
  /** 입력 길이. 안내 문구의 `n / 12`에 쓴다. */
  length: number;
  /** 중복 확인을 통과했는지. 통과해야 다음으로 넘어갈 수 있다. */
  checked: boolean;
  checking: boolean;
  /** 쓸 수 없는 이유. 문제가 없으면 null. */
  error: string | null;
  /**
   * 지금 쓰고 있는 이름 그대로인지.
   *
   * 서버는 자기 이름도 "이미 있음"으로 답하므로(`existsByNickname`) 그 경우를 갈라 둔다.
   * 확인은 묻지 않고 통과시키고, 화면은 "지금 쓰고 있는 이름"이라고 알린다.
   * 비교 대상을 넘기지 않은 곳(온보딩)에서는 늘 거짓이다.
   */
  isOwn: boolean;
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
  INVALID_NICKNAME: `${NICKNAME_MIN_LENGTH}~${NICKNAME_MAX_LENGTH}자의 한글, 영문, 숫자만 쓸 수 있어요.`,
  UNAUTHORIZED: '로그인이 필요해요.',
  NICKNAME_AVAILABILITY_CHECK_FAILED: '중복을 확인하지 못했어요. 잠시 후 다시 시도해 주세요.',
};

/**
 * 닉네임 입력과 중복 확인.
 *
 * 화면은 이 훅이 준 값으로 입력란과 버튼만 그리고, 검증·확인 해제 판단은 전부 여기서 한다.
 *
 * 마이페이지 닉네임 수정과 온보딩 2단계가 같이 쓴다. 중복 확인 API가 공개 경로라 온보딩처럼
 * 아직 액세스 토큰이 없는 단계에서도 그대로 부를 수 있어, 호출을 나눌 필요가 없다.
 *
 * 값을 고치면 중복 확인이 풀린다. 확인한 뒤 다른 이름으로 바꿔 놓고 넘어가는 것을 막는다.
 *
 * 확인을 통과하면 서버가 정규화한 값을 입력란에 되돌려 넣는다. 영문 대소문자를 구분하지
 * 않아 실제로 저장되는 값이 입력한 값과 다를 수 있어, 저장 전에 그 값을 보여준다.
 *
 * @param initial 입력란의 초기값. 마이페이지에서 현재 닉네임을 채워 넣을 때 쓴다.
 */
export function useNicknameCheck(initial = '', ownNickname?: string): NicknameCheck {
  const [nickname, setNickname] = useState(initial);
  /** 지금 쓰고 있는 이름 그대로인지. 대소문자 차이는 서버가 정규화하므로 같은 기준으로 본다. */
  const isOwn =
    ownNickname !== undefined &&
    ownNickname !== '' &&
    normalizeNickname(nickname.trim()) === normalizeNickname(ownNickname);
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

    /*
      **지금 쓰고 있는 이름은 묻지 않는다.**

      서버의 중복 확인은 `existsByNickname`만 보아서 자기 이름도 "이미 있음"으로 답한다.
      그대로 두면 이름을 그대로 두려는 사람이 자기 이름에 막힌다 — 물어보기 전에 통과시키고,
      화면은 그 사정을 문구로 알린다(`isOwn`).
    */
    if (isOwn) {
      setChecked(true);
      setError(null);
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
    isOwn,
    canCheck: length >= NICKNAME_MIN_LENGTH && !checking,
    change,
    check,
    invalidate,
  };
}
