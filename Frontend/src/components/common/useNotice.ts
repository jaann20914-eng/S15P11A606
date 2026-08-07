import { useCallback, useState } from 'react';

export interface NoticeRequest {
  title: string;
  /** 줄바꿈은 `\n`으로 넣는다. */
  message: string;
  /** 확인을 누른 뒤 할 일. 없으면 닫기만 한다. */
  onConfirm?: () => void;
  confirmLabel?: string;
}

export interface NoticeState {
  /** 지금 띄울 안내. 없으면 null이다. */
  notice: NoticeRequest | null;
  /** 안내를 띄운다. 이미 떠 있으면 새 내용으로 갈아 끼운다. */
  showNotice: (request: NoticeRequest) => void;
  /** 확인 처리. 딸린 일이 있으면 실행하고 닫는다. */
  confirmNotice: () => void;
}

/**
 * 화면이 안내 모달(`NoticeModal`)을 띄우는 자리.
 *
 * 네이티브 `Alert`을 대신한다. OS 대화상자는 화면과 결이 달라 앱 안에서 이질적으로 보이고,
 * 안드로이드는 겹쳐 뜬 것을 큐에 넣어 "확인이 한 번에 안 먹는" 것처럼 굴었다(2026-08-05).
 * 우리 모달은 모양도 닫는 시점도 우리가 정한다.
 *
 * 화면마다 상태를 따로 두면 같은 코드가 네 번 생기므로 여기 한 곳에 둔다. 쓰는 쪽은
 * `showNotice(...)`로 띄우고, 그린 `NoticeModal`에 아래 값들을 그대로 넘기면 된다.
 */
export function useNotice(): NoticeState {
  const [notice, setNotice] = useState<NoticeRequest | null>(null);

  return {
    notice,
    showNotice: useCallback((request: NoticeRequest) => setNotice(request), []),
    confirmNotice: useCallback(() => {
      setNotice((current) => {
        current?.onConfirm?.();
        return null;
      });
    }, []),
  };
}
