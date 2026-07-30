import { useCallback, useState } from 'react';
import { router } from 'expo-router';
import { useSessionStore } from '@/store/useSessionStore';

export interface LogoutController {
  /** 확인 모달이 열려 있는지. */
  confirming: boolean;
  /** 확인 모달을 연다. 버튼을 누르자마자 나가지는 않는다. */
  ask: () => void;
  /** 확인 모달을 닫는다. 세션은 그대로 둔다. */
  cancel: () => void;
  /** 세션을 비우고 로그인 화면으로 보낸다. */
  confirm: () => void;
}

/**
 * 로그아웃.
 *
 * 실수로 눌러 나가는 일이 없도록 확인을 한 번 받는다. 확인하면 세션을 비우고 로그인으로
 * 보내는데, `replace`로 옮겨 뒤로 가기로 앱 안으로 돌아올 수 없게 한다.
 *
 * 서버에는 요청하지 않는다. 액세스 토큰은 stateless JWT라 서버가 폐기할 수 없고, 리프레시
 * 토큰은 메모리에만 있어 세션을 비우면 그 값을 아는 곳이 없어진다. 토큰을 기기에 저장하게
 * 되면 남은 리프레시 토큰을 서버에서 폐기해야 하므로, 그때 이 자리에 호출을 넣는다.
 */
export function useLogout(): LogoutController {
  const [confirming, setConfirming] = useState(false);
  const clearSession = useSessionStore((state) => state.clearSession);

  const ask = useCallback(() => setConfirming(true), []);
  const cancel = useCallback(() => setConfirming(false), []);

  const confirm = useCallback(() => {
    setConfirming(false);
    clearSession();
    router.replace('/(auth)/login');
  }, [clearSession]);

  return { confirming, ask, cancel, confirm };
}
