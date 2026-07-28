import { useCallback, useState } from 'react';
import { router } from 'expo-router';
import { deletePin, leavePinChats } from '@/api/pins';
import { goBackOrHome } from '@/utils/navigation';
import type { PinDetail, PinRating } from '@/types/pin';

/** 열림/닫힘만 있는 단순 모달. */
export interface ToggleState {
  open: boolean;
  show: () => void;
  hide: () => void;
}

/** 서버 호출을 동반하는 확인 모달. 실패해도 닫지 않고 문구를 남긴다. */
export interface ConfirmActionState extends ToggleState {
  busy: boolean;
  error: string | null;
  confirm: () => void;
}

function useToggle(): ToggleState {
  const [open, setOpen] = useState(false);

  return {
    open,
    show: useCallback(() => setOpen(true), []),
    hide: useCallback(() => setOpen(false), []),
  };
}

/**
 * "열기 → 실행 → 성공하면 이전 화면" 흐름을 공유한다.
 * 삭제와 "이미 떠났어요"가 결과만 다르고 모양이 같다.
 */
function useConfirmAction(run: () => Promise<unknown>, fallbackMessage: string): ConfirmActionState {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const show = useCallback(() => {
    setError(null);
    setOpen(true);
  }, []);

  const hide = useCallback(() => setOpen(false), []);

  const confirm = useCallback(() => {
    setBusy(true);
    setError(null);

    run()
      .then(() => {
        setBusy(false);
        setOpen(false);
        goBackOrHome();
      })
      .catch((cause: unknown) => {
        setBusy(false);
        setError(cause instanceof Error ? cause.message : fallbackMessage);
      });
  }, [run, fallbackMessage]);

  return { open, busy, error, show, hide, confirm };
}

export interface PinDetailScreenState {
  menu: ToggleState & { toggle: () => void; edit: () => void };
  purchase: ToggleState & { confirm: () => void };
  chat: ToggleState & { confirm: () => void };
  remove: ConfirmActionState;
  leave: ConfirmActionState;
  rate: (rating: PinRating) => void;
  /**
   * 이번 화면에서 사용자가 고른 평가.
   *
   * 서버는 완료 여부(`isEvaluated`)만 돌려주고 유익/아쉬움을 구분하지 않는다.
   * 방금 누른 직후에만 구체적인 문구를 보여주고 재진입하면 일반 문구로 돌아간다.
   */
  submittedRating: PinRating | null;
}

/**
 * 게시글 상세 화면의 상호작용 상태를 모은다.
 * 화면 컴포넌트는 이 훅이 준 것만 쓰고 자체 `useState`를 두지 않는다.
 *
 * 데이터 로딩은 `usePinDetail`이 담당한다. 여기서는 그 결과를 바꾸는 동작만 다룬다.
 */
export function usePinDetailScreen(
  detail: PinDetail,
  onDetailChange: (patch: Partial<PinDetail>) => void,
): PinDetailScreenState {
  const menu = useToggle();
  const purchase = useToggle();
  const chat = useToggle();
  const [submittedRating, setSubmittedRating] = useState<PinRating | null>(null);

  const remove = useConfirmAction(
    useCallback(() => deletePin(detail.pinId), [detail.pinId]),
    '삭제하지 못했어요',
  );

  const leave = useConfirmAction(
    useCallback(() => leavePinChats(detail.pinId), [detail.pinId]),
    '처리하지 못했어요',
  );

  // TODO: 결제·채팅요청·평가 API 명세가 나오면 낙관적 갱신 전에 서버 호출을 넣는다.
  const confirmPurchase = useCallback(() => {
    onDetailChange({ videoAccess: 'UNLOCKED', isEvaluated: false, canRequestChat: true });
    purchase.hide();
  }, [onDetailChange, purchase]);

  const confirmChat = useCallback(() => {
    onDetailChange({ chatRequestState: 'PENDING', canRequestChat: false });
    chat.hide();
  }, [onDetailChange, chat]);

  const rate = useCallback(
    (rating: PinRating) => {
      setSubmittedRating(rating);
      onDetailChange({ isEvaluated: true });
    },
    [onDetailChange],
  );

  return {
    menu: {
      ...menu,
      toggle: useCallback(() => (menu.open ? menu.hide() : menu.show()), [menu]),
      // 실제 수정 폼은 pin-create 흐름을 재사용한다.
      edit: useCallback(() => {
        menu.hide();
        router.push('/pin-create/detail-form');
      }, [menu]),
    },
    purchase: { ...purchase, confirm: confirmPurchase },
    chat: { ...chat, confirm: confirmChat },
    remove,
    leave,
    rate,
    submittedRating,
  };
}
