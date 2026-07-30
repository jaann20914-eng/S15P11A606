import { useCallback, useState } from 'react';
import { router } from 'expo-router';
import { ApiError, NETWORK_ERROR_CODE } from '@/api/client';
import { submitOnboarding } from '@/api/onboarding/complete';
import { useAuthStore } from '@/store/useAuthStore';
import type { OnboardingSubmission } from '@/types/onboarding';

/**
 * 오류 코드별 안내 문구.
 *
 * `INVALID_ONBOARDING_REQUEST`는 화면이 못 막은 값이 넘어간 경우라 앱 쪽 문제에 가깝다.
 */
const ERROR_MESSAGE: Record<string, string> = {
  INVALID_ONBOARDING_REQUEST: '입력한 정보를 다시 확인해 주세요',
  NICKNAME_ALREADY_EXISTS: '이미 사용 중인 닉네임이에요',
  ONBOARDING_FAILED: '가입을 마치지 못했어요. 잠시 후 다시 시도해 주세요',
  [NETWORK_ERROR_CODE]: '네트워크 연결을 확인하고 다시 시도해 주세요',
};

/**
 * 다시 로그인해야 회복되는 오류들.
 *
 * 온보딩 토큰은 일회성이고 재발급 수단이 없다. 무효·사용완료거나 이미 온보딩을 끝낸
 * 계정이면 이 화면에서 할 수 있는 게 없으므로 세션을 비우고 로그인으로 되돌린다.
 */
const REQUIRES_RELOGIN: Record<string, string> = {
  INVALID_ONBOARDING_TOKEN: '로그인이 만료됐어요. 다시 로그인해 주세요',
  ONBOARDING_TOKEN_ALREADY_USED: '이미 처리된 요청이에요. 다시 로그인해 주세요',
  ONBOARDING_ALREADY_COMPLETED: '이미 가입이 완료된 계정이에요. 다시 로그인해 주세요',
};

export interface OnboardingSubmitState {
  busy: boolean;
  /** 실패 문구. 다시 시도하면 사라진다. */
  error: string | null;
  submit: (submission: OnboardingSubmission) => void;
}

/**
 * 온보딩 완료 요청과 그 뒤처리.
 *
 * 성공하면 서비스 토큰을 저장하고 온보딩 토큰을 버린 뒤 홈으로 보낸다.
 * 저장이 끝나기 전에 이동하면 홈의 첫 요청이 토큰 없이 나갈 수 있어 순서를 지킨다.
 *
 * @param onNicknameTaken 닉네임 중복일 때 호출한다. 화면은 닉네임 단계로 되돌린다.
 */
export function useOnboardingSubmit(onNicknameTaken?: () => void): OnboardingSubmitState {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const completeOnboarding = useAuthStore((state) => state.completeOnboarding);
  const signOut = useAuthStore((state) => state.signOut);

  const submit = useCallback(
    (submission: OnboardingSubmission) => {
      if (busy) return;

      setBusy(true);
      setError(null);

      submitOnboarding(submission)
        .then((result) => completeOnboarding(result))
        .then(() => {
          setBusy(false);
          router.replace('/(tabs)/home');
        })
        .catch((cause: unknown) => {
          setBusy(false);

          if (!(cause instanceof ApiError)) {
            setError('가입을 마치지 못했어요. 다시 시도해 주세요');
            return;
          }

          const reloginMessage = REQUIRES_RELOGIN[cause.code];
          if (reloginMessage !== undefined) {
            setError(reloginMessage);
            void signOut().then(() => router.replace('/(auth)/login'));
            return;
          }

          setError(ERROR_MESSAGE[cause.code] ?? cause.message);
          if (cause.code === 'NICKNAME_ALREADY_EXISTS') onNicknameTaken?.();
        });
    },
    [busy, completeOnboarding, signOut, onNicknameTaken],
  );

  return { busy, error, submit };
}
