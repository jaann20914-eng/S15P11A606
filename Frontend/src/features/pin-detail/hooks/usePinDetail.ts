import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { getPinDetail } from '@/api/pin/detail';
import { ApiError } from '@/api/client';
import type { AsyncStatus } from '@/types/common';
import type { PinId, PinDetail } from '@/types/pin';

export interface PinDetailState {
  status: AsyncStatus;
  data: PinDetail | null;
  /** 사용자에게 그대로 보여줄 수 있는 문구. 성공이면 null. */
  error: string | null;
  /** 서버가 내려준 오류 코드. 화면이 `PIN_NOT_FOUND` 등으로 분기할 때 쓴다. */
  errorCode: string | null;
}

export interface UsePinDetailResult extends PinDetailState {
  reload: () => void;
  /**
   * 이미 받아 둔 상세를 부분 갱신한다.
   * 결제·평가·채팅 요청 직후 전체를 다시 불러오지 않고 화면을 먼저 바꾸기 위한 통로다.
   */
  patchDetail: (patch: Partial<PinDetail>) => void;
}

const idleState: PinDetailState = { status: 'idle', data: null, error: null, errorCode: null };

function toErrorState(error: unknown): PinDetailState {
  if (error instanceof ApiError) {
    return { status: 'error', data: null, error: error.message, errorCode: error.code };
  }

  const message = error instanceof Error ? error.message : '잠시 후 다시 시도해 주세요';
  return { status: 'error', data: null, error: message, errorCode: null };
}

/**
 * 게시글 상세를 불러온다. 목업/실서버 판단은 `@/api/pin/detail`이 하므로 화면은 구분하지 않는다.
 *
 * `pinId`가 null이면(경로 파라미터가 아직 없거나 숫자가 아니면) 요청하지 않고 대기한다.
 */
export function usePinDetail(pinId: PinId | null): UsePinDetailResult {
  const [state, setState] = useState<PinDetailState>(idleState);

  // 응답이 늦게 도착한 이전 요청이 최신 상태를 덮어쓰지 않도록 순번을 매긴다.
  const latestRequestRef = useRef(0);

  const load = useCallback(() => {
    if (pinId === null) {
      latestRequestRef.current += 1;
      setState(idleState);
      return;
    }

    const requestId = (latestRequestRef.current += 1);
    setState({ status: 'loading', data: null, error: null, errorCode: null });

    getPinDetail(pinId)
      .then((detail) => {
        if (latestRequestRef.current !== requestId) return;
        setState({ status: 'success', data: detail, error: null, errorCode: null });
      })
      .catch((error: unknown) => {
        if (latestRequestRef.current !== requestId) return;
        setState(toErrorState(error));
      });
  }, [pinId]);

  /*
    화면이 다시 보일 때마다 새로 받는다.

    이 화면에서 수정으로 갔다가 돌아오는 길이 있다. 처음 받은 값을 그대로 두면 고친 내용이
    반영되지 않은 화면이 남아, 수정이 안 된 것으로 읽힌다.
  */
  useFocusEffect(load);

  const patchDetail = useCallback((patch: Partial<PinDetail>) => {
    setState((prev) => (prev.data ? { ...prev, data: { ...prev.data, ...patch } } : prev));
  }, []);

  return { ...state, reload: load, patchDetail };
}

/**
 * 경로 파라미터(`string | string[]`)를 핀 식별자로 바꾼다. 비어 있으면 null.
 *
 * 식별자가 UUID라 형식을 여기서 따지지 않는다. 모양이 맞는지는 서버가 판단하고, 없는 핀이면
 * 404가 온다. 프론트가 정규식으로 미리 거르면 서버가 형식을 바꿀 때 화면만 먼저 막힌다.
 */
export function parsePinId(param: string | string[] | undefined): PinId | null {
  const raw = Array.isArray(param) ? param[0] : param;
  return raw?.trim() || null;
}
