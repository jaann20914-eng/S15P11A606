import { useCallback, useState } from 'react';
import { useAuthStore } from '@/store/useAuthStore';

export interface LogoutController {
  /** 확인 모달이 열려 있는지. */
  confirming: boolean;
  /** 세션을 정리하는 중인지. 버튼을 잠그고 스피너를 보여준다. */
  busy: boolean;
  /** 정리에 실패했을 때의 문구. 모달을 닫지 않고 그 자리에 보여준다. */
  error: string | null;
  /** 확인 모달을 연다. 버튼을 누르자마자 나가지는 않는다. */
  ask: () => void;
  /** 확인 모달을 닫는다. 세션은 그대로 둔다. */
  cancel: () => void;
  /** 세션을 비운다. */
  confirm: () => void;
}

/**
 * 로그아웃.
 *
 * 실수로 눌러 나가는 일이 없도록 확인을 한 번 받는다. 확인하면 `useAuthStore.signOut`이
 * 메모리와 보안 저장소의 토큰을 모두 지운다.
 *
 * 로그인 화면으로 보내는 일은 이 훅이 하지 않는다. 세션이 끊기면 `useAuthSession`이 보호된
 * 화면에서 내보내므로, 여기서 또 옮기면 같은 이동을 두 곳이 맡게 된다. 재발급 실패로 세션이
 * 끊길 때와 같은 경로를 타는 것이 맞다.
 *
 * 서버에는 요청하지 않는다. 액세스 토큰은 stateless JWT라 서버가 폐기할 수 없고, 리프레시
 * 토큰은 저장소에서 지우면 그 값을 아는 곳이 없어진다. 서버에 폐기 엔드포인트가 생기면
 * 기기에 남은 리프레시 토큰을 무효화하려고 여기서 부르면 된다.
 */
export function useLogout(): LogoutController {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const signOut = useAuthStore((state) => state.signOut);

  const ask = useCallback(() => {
    setConfirming(true);
    setError(null);
  }, []);

  const cancel = useCallback(() => {
    setConfirming(false);
    setError(null);
  }, []);

  const confirm = useCallback(() => {
    if (busy) return;
    setBusy(true);
    setError(null);

    void signOut()
      .catch(() => {
        // 저장소를 지우지 못하면 세션이 남아 있다. 나간 것처럼 보이게 두면 안 된다.
        setError('로그아웃하지 못했어요. 잠시 후 다시 시도해 주세요.');
      })
      .finally(() => setBusy(false));
  }, [busy, signOut]);

  return { confirming, busy, error, ask, cancel, confirm };
}
