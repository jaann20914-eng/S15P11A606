import { useCallback, useRef, useState } from 'react';
import { ApiError } from '@/api/client';
import { createPin } from '@/api/pin/create';
import { issueVideoUploadTicket } from '@/api/pin/videoUpload';
import { readVideoSize, startVideoUpload } from '@/api/pin/videoUploadTask';
import { getCrowdLevelByValue } from '@/constants/crowdLevels';
import { toServerCrowdLevel } from '@/types/pin';
import { MAX_PLACE_DISTANCE_METERS, VIDEO_CONTENT_TYPE } from '@/types/pinCreate';
import type {
  PinCreateRequest,
  PinDraft,
  PinVideoStatus,
  VideoUploadPhase,
  VideoUploadTicket,
} from '@/types/pinCreate';

export interface PinPublish {
  /** 등록이 진행 중. 이 동안 진행 화면에 머문다. */
  publishing: boolean;
  /** 지금 어느 단계인지. 진행 화면 문구를 고른다. */
  phase: VideoUploadPhase;
  /** 업로드 진행률 0~1. 업로드 단계에서만 의미가 있다. */
  progress: number;
  /** 접수된 핀. 202를 받으면 채워진다. */
  pinId: number | null;
  videoStatus: PinVideoStatus | null;
  error: string | null;
  /** 다시 시도할 수 있는 실패인지. 업로드 실패와 저장 실패가 해당한다. */
  retryable: boolean;
  publish: (draft: PinDraft) => void;
  /** 진행 중인 업로드를 중단하고 작성 화면으로 돌아간다. */
  cancel: () => void;
  /** 실패 문구를 지운다. */
  dismissError: () => void;
}

/**
 * 촬영 좌표.
 *
 * 서버가 선택한 장소와 50m 이내인지 검증한다. 촬영 시점 좌표를 따로 들고 있지 않아
 * 지금은 선택한 장소의 좌표를 쓴다. 같은 자리에서 찍고 고르는 흐름이라 실제와 큰 차이가
 * 없지만, 촬영 시점 좌표를 기록해 두는 편이 정확하다.
 */
function toRequest(draft: PinDraft, originalVideoKey: string): PinCreateRequest | null {
  if (!draft.place) return null;

  const memo = draft.memo.trim();
  const detailLocation = draft.detailLocation.trim();

  return {
    originalVideoKey,
    kakaoPlaceId: draft.place.kakaoPlaceId,
    latitude: draft.place.latitude,
    longitude: draft.place.longitude,
    crowdLevel: toServerCrowdLevel(getCrowdLevelByValue(draft.crowdLevel).key),
    // 선택 항목은 비어 있으면 보내지 않는다.
    ...(detailLocation ? { detailLocation } : {}),
    ...(memo ? { memo } : {}),
    ...(draft.tags.length > 0 ? { tags: draft.tags } : {}),
  };
}

/** 오류 코드별 안내. 사용자가 다음에 무엇을 해야 하는지가 다르다. */
const messageByCode: Record<string, string> = {
  LOCATION_OUT_OF_RANGE: `선택한 장소와 촬영 위치가 너무 멀어요. ${MAX_PLACE_DISTANCE_METERS}m 안의 장소를 골라 주세요.`,
  VIDEO_NOT_ACCESSIBLE: '영상을 올리지 못했어요. 다시 촬영해 주세요.',
  VIDEO_ALREADY_REGISTERED: '이미 등록에 사용한 영상이에요. 다시 촬영해 주세요.',
  PLACE_NOT_FOUND: '선택한 장소를 찾을 수 없어요. 다시 검색해 주세요.',
  INVALID_CROWD_LEVEL: '혼잡 단계를 다시 선택해 주세요.',
  DAILY_PIN_LIMIT_EXCEEDED: '오늘 등록할 수 있는 핀 수를 다 썼어요. 내일 다시 시도해 주세요.',
  PIN_CREATE_FAILED: '핀 등록에 실패했어요. 잠시 후 다시 시도해 주세요.',
};

/** 다시 시도해서 풀릴 수 있는 실패. 입력을 고쳐야 하는 실패와 구분한다. */
const retryableCodes = new Set(['PIN_CREATE_FAILED', 'NETWORK_ERROR']);

/**
 * 핀 등록.
 *
 * 세 단계를 순서대로 밟는다. 업로드가 성공한 경우에만 등록 API를 부른다.
 *
 * 1. 발급 — Presigned URL과 `originalVideoKey`를 받는다
 * 2. 업로드 — 그 URL로 외부 스토리지에 직접 올린다
 * 3. 등록 — 객체 키와 메타데이터를 서버에 보낸다
 *
 * 재시도할 때는 이미 올린 영상을 다시 올리지 않고 **같은 `originalVideoKey`를 재사용**한다.
 * 명세가 그렇게 요구하고, 서버는 중복 등록을 409로 거절한다.
 *
 * 서버는 202로 접수만 하고 AI 블러 처리는 비동기로 돈다. 상태 조회 API가 아직 없어
 * `PENDING` 이후는 확인할 수 없다.
 */
export function usePinPublish(): PinPublish {
  const [phase, setPhase] = useState<VideoUploadPhase>('idle');
  const [progress, setProgress] = useState(0);
  const [pinId, setPinId] = useState<number | null>(null);
  const [videoStatus, setVideoStatus] = useState<PinVideoStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryable, setRetryable] = useState(false);

  /** 발급받은 티켓. 재시도할 때 같은 키를 쓰기 위해 들고 있는다. */
  const ticketRef = useRef<VideoUploadTicket | null>(null);
  /** 진행 중인 업로드를 취소하기 위한 손잡이. */
  const cancelUploadRef = useRef<(() => void) | null>(null);
  /** 취소된 시도의 결과가 화면을 되살리지 못하게 막는다. */
  const attemptRef = useRef(0);

  const fail = useCallback((message: string, canRetry: boolean) => {
    setPhase('idle');
    setProgress(0);
    setError(message);
    setRetryable(canRetry);
  }, []);

  const publish = useCallback(
    (draft: PinDraft) => {
      if (!draft.video || !draft.place) return;

      const attempt = attemptRef.current + 1;
      attemptRef.current = attempt;
      const alive = () => attemptRef.current === attempt;

      setError(null);
      setRetryable(false);
      setProgress(0);

      const fileUri = draft.video.uri;

      const run = async () => {
        // 1. 발급 — 이미 받은 티켓이 있으면 재사용한다.
        let ticket = ticketRef.current;

        if (!ticket) {
          setPhase('issuing');
          const size = await readVideoSize(fileUri);
          ticket = await issueVideoUploadTicket(VIDEO_CONTENT_TYPE, size);
          if (!alive()) return;
          ticketRef.current = ticket;

          // 2. 업로드 — 티켓을 새로 받았을 때만 올린다.
          setPhase('uploading');
          const upload = startVideoUpload(ticket, fileUri, (ratio) => {
            if (alive()) setProgress(ratio);
          });
          cancelUploadRef.current = upload.cancel;

          await upload.completed;
          cancelUploadRef.current = null;
          if (!alive()) return;
        }

        // 3. 등록 — 업로드가 끝난 뒤에만 호출한다.
        const body = toRequest(draft, ticket.originalVideoKey);
        if (!body) return;

        setPhase('registering');
        const result = await createPin(body);
        if (!alive()) return;

        setPinId(result.pinId);
        setVideoStatus(result.videoStatus);
        setPhase('done');
      };

      run().catch((cause: unknown) => {
        cancelUploadRef.current = null;
        if (!alive()) return;

        if (cause instanceof ApiError) {
          fail(messageByCode[cause.code] ?? cause.message, retryableCodes.has(cause.code));
          return;
        }

        // 업로드 실패는 네트워크 문제가 대부분이라 다시 시도할 값이 있다.
        fail(cause instanceof Error ? cause.message : '핀을 등록하지 못했어요', true);
      });
    },
    [fail],
  );

  const cancel = useCallback(() => {
    attemptRef.current += 1;
    cancelUploadRef.current?.();
    cancelUploadRef.current = null;
    // 취소하면 올려 둔 영상을 쓰지 않으므로 티켓도 버린다.
    ticketRef.current = null;
    setPhase('idle');
    setProgress(0);
    setError(null);
    setRetryable(false);
  }, []);

  return {
    publishing: phase !== 'idle',
    phase,
    progress,
    pinId,
    videoStatus,
    error,
    retryable,
    publish,
    cancel,
    dismissError: useCallback(() => setError(null), []),
  };
}
