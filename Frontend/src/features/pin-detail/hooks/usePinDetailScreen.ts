import { useCallback, useRef, useState } from 'react';
import { router } from 'expo-router';
import { ApiError } from '@/api/client';
import { leavePinChats } from '@/api/chat/leave';
import { createChatRequest } from '@/api/chat/request';
import { evaluatePin } from '@/api/pin/evaluate';
import { deletePin } from '@/api/pin/remove';
import { unlockPin } from '@/api/pin/unlock';
import { rememberEditablePin } from '@/features/pin-create/editHandoff';
import { isPinLeft, markPinLeft } from '@/store/leftPins';
import { createIdempotencyKey } from '@/utils/idempotency';
import { goBackOrHome } from '@/utils/navigation';
import type { PinId, PinDetail, PinRating } from '@/types/pin';

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
  /** 이미 처리를 끝냈는지. 화면에 남는 동작(떠났어요)에서 버튼을 잠그는 데 쓴다. */
  done: boolean;
  confirm: () => void;
}

/*
  "이미 떠났어요"를 끝낸 핀의 기억은 공용 모듈로 옮겼다(`store/leftPins`). 채팅 목록이
  글 줄을 연하게 누르는 판정에도 같은 값이 필요해서다. 세션 동안만 남는 성질은 그대로다.
*/

function useToggle(): ToggleState {
  const [open, setOpen] = useState(false);

  return {
    open,
    show: useCallback(() => setOpen(true), []),
    hide: useCallback(() => setOpen(false), []),
  };
}

/**
 * "열기 → 실행 → 성공" 흐름을 공유한다. 삭제와 "이미 떠났어요"가 모양이 같다.
 *
 * 성공한 뒤가 다르다. 삭제한 핀은 더 볼 것이 없어 이전 화면으로 돌아가고, 떠난 핀은 글과
 * 크레딧이 그대로 남아 화면에 머문다. 머무는 쪽은 같은 버튼을 다시 누르지 못하게 잠근다.
 */
function useConfirmAction(
  run: () => Promise<unknown>,
  fallbackMessage: string,
  options: { stay?: boolean; doneAtStart?: boolean } = {},
): ConfirmActionState {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(options.doneAtStart ?? false);

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
        setDone(true);

        if (options.stay !== true) goBackOrHome();
      })
      .catch((cause: unknown) => {
        setBusy(false);
        setError(cause instanceof Error ? cause.message : fallbackMessage);
      });
  }, [run, fallbackMessage, options.stay]);

  return { open, busy, error, done, show, hide, confirm };
}

/** 결제 모달. 실패하면 닫지 않고 문구를 남겨 같은 멱등성 키로 재시도할 수 있게 한다. */
export interface PurchaseState extends ToggleState {
  busy: boolean;
  error: string | null;
  confirm: () => void;
}

/**
 * 영상 잠금 해제 결제.
 *
 * 멱등성 키는 모달을 열 때 한 번 만들고 그 모달이 닫힐 때까지 재사용한다.
 * 실패해서 다시 누르는 것은 "같은 결제의 재시도"이므로 같은 키를 보내야 중복 차감되지 않는다.
 */
function usePurchase(pinId: PinId, onDetailChange: (patch: Partial<PinDetail>) => void): PurchaseState {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const keyRef = useRef<string | null>(null);

  const show = useCallback(() => {
    keyRef.current = createIdempotencyKey();
    setError(null);
    setOpen(true);
  }, []);

  const hide = useCallback(() => setOpen(false), []);

  const confirm = useCallback(() => {
    const key = keyRef.current ?? createIdempotencyKey();
    keyRef.current = key;

    setBusy(true);
    setError(null);

    unlockPin(pinId, key)
      .then((result) => {
        setBusy(false);
        setOpen(false);
        onDetailChange({
          videoAccess: 'UNLOCKED',
          videoUrl: result.videoUrl,
          previewUrl: null,
          isEvaluated: false,
          // 구매 직후에는 대기 중인 요청이나 방이 없으므로 요청 가능하다.
          // 서버 판정과 어긋나면 다음 조회에서 정정된다.
          canRequestChat: true,
        });
      })
      .catch((cause: unknown) => {
        setBusy(false);
        setError(cause instanceof Error ? cause.message : '결제하지 못했어요');
      });
  }, [pinId, onDetailChange]);

  return { open, busy, error, show, hide, confirm };
}

/** 평가 등록. 인라인 영역이라 모달처럼 열고 닫지 않고 버튼을 바로 누른다. */
export interface EvaluationState {
  busy: boolean;
  error: string | null;
  /**
   * 이번 화면에서 사용자가 고른 평가.
   *
   * 상세 조회는 완료 여부(`isEvaluated`)만 돌려주고 유익/아쉬움을 구분하지 않는다.
   * 방금 누른 직후에만 구체적인 문구를 보여주고 재진입하면 일반 문구로 돌아간다.
   */
  submitted: PinRating | null;
  /** 서버가 지급한 크레딧. 재진입 시에는 알 수 없어 null이다. */
  rewardCredit: number | null;
  submit: (rating: PinRating) => void;
}

/** 채팅 요청 모달. 실패하면 닫지 않고 문구를 남긴다. */
export interface ChatRequestState extends ToggleState {
  busy: boolean;
  error: string | null;
  confirm: () => void;
}

export interface PinDetailScreenState {
  menu: ToggleState & { toggle: () => void; edit: () => void };
  purchase: PurchaseState;
  chat: ChatRequestState;
  remove: ConfirmActionState;
  leave: ConfirmActionState;
  evaluation: EvaluationState;
}

/**
 * 핀 평가 등록.
 *
 * 이미 평가한 핀이면 서버가 409를 준다. 그때는 오류로 남기지 않고
 * 화면을 "평가 완료"로 넘긴다 — 서버 상태가 그게 맞기 때문이다.
 */
function useEvaluation(pinId: PinId, onDetailChange: (patch: Partial<PinDetail>) => void): EvaluationState {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<PinRating | null>(null);
  const [rewardCredit, setRewardCredit] = useState<number | null>(null);

  const submit = useCallback(
    (rating: PinRating) => {
      setBusy(true);
      setError(null);

      evaluatePin(pinId, rating)
        .then((result) => {
          setBusy(false);
          setSubmitted(result.rating);
          setRewardCredit(result.rewardCredit);
          onDetailChange({ isEvaluated: true });
        })
        .catch((cause: unknown) => {
          setBusy(false);

          if (cause instanceof ApiError && cause.code === 'PIN_ALREADY_EVALUATED') {
            onDetailChange({ isEvaluated: true });
            return;
          }

          setError(cause instanceof Error ? cause.message : '평가를 등록하지 못했어요');
        });
    },
    [pinId, onDetailChange],
  );

  return { busy, error, submitted, rewardCredit, submit };
}

/**
 * 익명 채팅 요청.
 *
 * 이미 대기 중인 요청이나 활성 방이 있으면 서버가 409를 준다.
 * 그때는 오류로 남기지 않고 화면을 "수락 대기"로 넘긴다 — 서버 상태가 그게 맞다.
 */
function useChatRequest(pinId: PinId, onDetailChange: (patch: Partial<PinDetail>) => void): ChatRequestState {
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

    createChatRequest(pinId)
      .then((result) => {
        setBusy(false);
        setOpen(false);
        onDetailChange({ chatRequestState: 'PENDING', canRequestChat: false });
        /*
          만들어진 방으로 바로 들여보낸다. 수락 전에도 요청자는 메시지를 보낼 수 있으므로
          (서버 정책), 요청만 걸어 두고 목록에서 방을 다시 찾게 할 이유가 없다.
          뒤로 가면 이 상세로 돌아온다(push).
        */
        router.push({
          pathname: '/chat-room/[roomId]',
          params: { roomId: String(result.roomId), role: 'requester' },
        });
      })
      .catch((cause: unknown) => {
        setBusy(false);

        if (cause instanceof ApiError && cause.code === 'CHAT_REQUEST_ALREADY_EXISTS') {
          setOpen(false);
          onDetailChange({ chatRequestState: 'PENDING', canRequestChat: false });
          return;
        }

        /*
          크레딧 부족은 눌러 본 뒤에야 알 수 있다.

          상세 조회의 `canRequestChat`은 구매 여부·소유자·핀 상태·중복 요청만 본다. 잔액은
          그 안에 없어서 버튼이 열려 있는 채로 거절당한다. 서버 문구만 그대로 보이면 무엇을
          해야 하는지 알 수 없어 필요한 양을 적어 준다.
        */
        if (cause instanceof ApiError && cause.code === 'INSUFFICIENT_CREDIT') {
          setError('크레딧이 부족해요. 채팅을 요청하려면 5크레딧이 필요해요');
          return;
        }

        setError(cause instanceof Error ? cause.message : '채팅을 요청하지 못했어요');
      });
  }, [pinId, onDetailChange]);

  return { open, busy, error, show, hide, confirm };
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
  const purchase = usePurchase(detail.pinId, onDetailChange);
  const evaluation = useEvaluation(detail.pinId, onDetailChange);
  const chat = useChatRequest(detail.pinId, onDetailChange);

  const remove = useConfirmAction(
    useCallback(() => deletePin(detail.pinId), [detail.pinId]),
    '삭제하지 못했어요',
  );

  /*
    떠난 뒤에는 화면에 머물고 버튼을 잠근다. 글과 크레딧은 그대로 남으니 돌려보낼 이유가 없고,
    같은 버튼이 계속 눌리는 상태로 남아 있으면 처리가 됐는지 알 수 없다.

    잠글 근거는 상세 응답의 제보자 상태(`publisherStatus`, 2026-08-06 추가)다. 세션 기억
    (`store/leftPins`)은 배포 전 서버(값이 안 옴)와 떠난 직후 상세를 다시 받기 전의 빈틈을
    받친다.
  */
  const leave = useConfirmAction(
    useCallback(async () => {
      const result = await leavePinChats(detail.pinId);
      markPinLeft(detail.pinId);

      return result;
    }, [detail.pinId]),
    '처리하지 못했어요',
    { stay: true, doneAtStart: detail.publisherStatus === 'LEFT' || isPinLeft(detail.pinId) },
  );

  return {
    menu: {
      ...menu,
      toggle: useCallback(() => (menu.open ? menu.hide() : menu.show()), [menu]),
      // 수정은 작성 화면을 그대로 쓴다. pinId가 붙으면 그 화면이 수정 모드로 뜬다.
      edit: useCallback(() => {
        menu.hide();

        /*
          지금 보고 있는 핀을 그대로 넘긴다. 수정 화면은 시작값이 있어야 무엇이 바뀌었는지
          알 수 있는데, 그 값을 이 화면이 이미 들고 있다. 넘기지 않으면 같은 것을 한 번 더
          받으려고 사용자를 기다리게 한다.
        */
        rememberEditablePin(detail);
        /*
          수정은 상세 위에 쌓이는 제 화면으로 연다. 작성 탭으로 보내면 탭 이동이 상세를
          스택에서 치워 버려, 수정에서 뒤로 가면 홈으로 떨어진다(라우트 주석 참고).
        */
        router.push(`/pin/${detail.pinId}/edit`);
      }, [detail, menu]),
    },
    purchase,
    chat,
    remove,
    leave,
    evaluation,
  };
}
