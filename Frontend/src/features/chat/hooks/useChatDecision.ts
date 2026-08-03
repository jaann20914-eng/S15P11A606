import { useCallback, useState } from 'react';
import { ApiError } from '@/api/client';
import { decideChatRequest } from '@/api/chat/decision';
import { leavePinChats } from '@/api/chat/leave';
import type { ChatDecision } from '@/types/chat';
import type { PinId } from '@/types/pin';

export interface ChatDecisionState {
  /** 지금 처리 중인 방. 그 줄의 버튼만 잠그기 위해 번호로 들고 있다. */
  busyRoomId: number | null;
  error: string | null;
  /** 수락·거절한다. 끝나면 목록을 다시 받는다. */
  decide: (roomId: number, decision: ChatDecision) => void;
  dismissError: () => void;
}

/** 오류 코드별 안내. 무엇을 해야 하는지가 서로 다르다. */
const messageByCode: Record<string, string> = {
  CHAT_REQUEST_ALREADY_DECIDED: '이미 처리된 요청이에요. 목록을 새로 불러올게요.',
  CHAT_REQUEST_NOT_FOUND: '요청을 찾을 수 없어요. 이미 취소됐을 수 있어요.',
  CHAT_REQUEST_DECISION_FORBIDDEN: '이 요청에 응답할 권한이 없어요.',
  INSUFFICIENT_CREDIT: '요청한 분의 크레딧이 부족해 수락할 수 없어요.',
  INVALID_CHAT_DECISION: '요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.',
  CHAT_REQUEST_DECISION_FAILED: '요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.',
};

/**
 * 채팅 요청 수락·거절.
 *
 * 끝나면 목록을 다시 받는다. 화면에서 상태만 바꿔 두면 크레딧 이동 같은 서버 쪽 결과가 반영되지
 * 않고, 수락 순간 상대에게도 상태가 바뀌어 서버가 가진 것과 어긋날 수 있다.
 *
 * "이미 처리된 요청"도 다시 받는다. 그 사이 상대가 취소했거나 다른 기기에서 눌렀다는 뜻이라,
 * 목록을 새로 받으면 화면이 곧 사실과 맞는다.
 */
export function useChatDecision(reload: () => void): ChatDecisionState {
  const [busyRoomId, setBusyRoomId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const decide = useCallback(
    (roomId: number, decision: ChatDecision) => {
      setBusyRoomId(roomId);
      setError(null);

      decideChatRequest(roomId, decision)
        .then(() => {
          setBusyRoomId(null);
          reload();
        })
        .catch((cause: unknown) => {
          setBusyRoomId(null);

          if (cause instanceof ApiError) {
            setError(messageByCode[cause.code] ?? cause.message);

            if (cause.code === 'CHAT_REQUEST_ALREADY_DECIDED') reload();
            return;
          }

          setError('요청을 처리하지 못했어요');
        });
    },
    [reload],
  );

  return { busyRoomId, error, decide, dismissError: () => setError(null) };
}

export interface PinLeaveState {
  busy: boolean
  error: string | null;
  /** 이 게시글에 걸린 모든 방을 한 번에 끝낸다. */
  leave: () => void;
  dismissError: () => void;
}

/**
 * 게시글의 모든 채팅방 종료("떠났어요").
 *
 * 되돌릴 수 없어서 확인은 화면에서 한 번 받는다. 성공하면 목록을 다시 받아 상태가 전부
 * `LEFT`로 바뀐 것을 그대로 보여준다 — 목록에서 지우지는 않는다. 이력은 남아 있어야 한다.
 */
export function usePinLeave(pinId: PinId | null, reload: () => void): PinLeaveState {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const leave = useCallback(() => {
    if (pinId === null || busy) return;

    setBusy(true);
    setError(null);

    leavePinChats(pinId)
      .then(() => {
        setBusy(false);
        reload();
      })
      .catch((cause: unknown) => {
        setBusy(false);
        setError(cause instanceof Error ? cause.message : '채팅방을 종료하지 못했어요');
      });
  }, [busy, pinId, reload]);

  return { busy, error, leave, dismissError: () => setError(null) };
}
