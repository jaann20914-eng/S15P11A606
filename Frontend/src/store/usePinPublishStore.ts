import { ApiError } from '@/api/client';
import { createPin } from '@/api/pin/create';
import { getPinVideoStatus } from '@/api/pin/status';
import { issueVideoUploadTicket } from '@/api/pin/videoUpload';
import { readVideoSize, startVideoUpload } from '@/api/pin/videoUploadTask';
import { getCrowdLevelByValue } from '@/constants/crowdLevels';
import { toServerCrowdLevel } from '@/types/pin';
import {
  MAX_PLACE_DISTANCE_METERS,
  STATUS_POLL_INTERVAL_MS,
  STATUS_POLL_TIMEOUT_MS,
  VIDEO_CONTENT_TYPE,
} from '@/types/pinCreate';
import type {
  PinCreateRequest,
  PinDraft,
  PinVideoStatus,
  VideoUploadPhase,
  VideoUploadTicket,
} from '@/types/pinCreate';
import { readCurrentCoordinate } from '@/utils/location';
import { createStore } from './createStore';
import type { PinId } from '@/types/pin';
import type { Coordinate } from './useMapStore';

/**
 * 핀 등록 진행 상태.
 *
 * 화면이 아니라 스토어에 둔다. 업로드 도중에 사용자가 다른 탭으로 가도 끊기지 않아야 하고,
 * 작성 화면이 사라져도 요청은 계속 진행돼야 한다. 앱을 종료할 때만 중단된다.
 */
export interface PinPublishState {
  phase: VideoUploadPhase;
  /** 업로드 진행률 0~1. `uploading` 단계에서만 의미가 있다. */
  progress: number;
  /** 접수된 핀. 202를 받으면 채워진다. */
  pinId: PinId | null;
  videoStatus: PinVideoStatus | null;
  error: string | null;
  /** 다시 시도할 값이 있는 실패인지. */
  retryable: boolean;
  publish: (draft: PinDraft) => void;
  /** 진행 중인 업로드를 중단한다. */
  cancel: () => void;
  dismissError: () => void;
  /** 완료 처리를 끝낸 뒤 초기 상태로 돌린다. */
  reset: () => void;
}

/**
 * 등록 요청 본문.
 *
 * 좌표가 두 쌍이다. `kakaoPlaceLatitude`·`kakaoPlaceLongitude`는 **선택한 장소**의 자리이고
 * (서버가 그 장소를 아직 저장하지 않았을 때 만드는 데 참고한다), `latitude`·`longitude`는
 * **영상을 찍은 자리**다. 서버는 둘 사이 거리를 재서 50m를 넘으면 거절한다.
 *
 * 촬영 좌표를 얻지 못했으면 등록하지 않는다. 장소 좌표를 대신 넣으면 거리 검증이 항상
 * 통과해 버려서, 엉뚱한 곳에서 찍은 영상도 그 장소의 것으로 등록된다.
 */
function toRequest(
  draft: PinDraft,
  originalVideoKey: string,
  captured: Coordinate,
): PinCreateRequest | null {
  if (!draft.place) return null;

  const memo = draft.memo.trim();
  const detailLocation = draft.detailLocation.trim();

  return {
    originalVideoKey,
    kakaoPlaceId: draft.place.kakaoPlaceId,
    placeName: draft.place.name,
    kakaoPlaceLatitude: draft.place.latitude,
    kakaoPlaceLongitude: draft.place.longitude,
    latitude: captured.latitude,
    longitude: captured.longitude,
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
  INVALID_CROWD_LEVEL: '혼잡 단계를 다시 선택해 주세요.',
  INVALID_UPLOAD_REQUEST: '영상을 올릴 수 없어요. 다시 촬영해 주세요.',
  UPLOAD_URL_ISSUE_FAILED: '영상 업로드를 준비하지 못했어요. 잠시 후 다시 시도해 주세요.',
  DAILY_PIN_LIMIT_EXCEEDED: '오늘 등록할 수 있는 핀 수를 다 썼어요. 내일 다시 시도해 주세요.',
  PIN_CREATE_FAILED: '핀 등록에 실패했어요. 잠시 후 다시 시도해 주세요.',
};

/** 다시 시도해서 풀릴 수 있는 실패. 입력을 고쳐야 하는 실패와 구분한다. */
const retryableCodes = new Set(['PIN_CREATE_FAILED', 'UPLOAD_URL_ISSUE_FAILED', 'NETWORK_ERROR']);

/**
 * 등록이 어느 단계에서 막혔는지 터미널에서 따라갈 수 있게 한다.
 *
 * 이 흐름은 발급 → 업로드 → 등록 → 처리 대기의 네 단계이고 서로 다른 서버를 탄다(우리 서버,
 * S3, 다시 우리 서버). 화면에는 문구 하나만 뜨므로 어디서 끊겼는지 로그가 없으면 알 수 없다.
 */
function logPublish(step: string, detail?: Record<string, unknown>): void {
  if (!__DEV__) return;
  console.log(`[pin-publish] ${step}`, detail ?? '');
}

/**
 * 촬영 좌표를 지금 읽는다.
 *
 * 실패해도 예외를 던지지 않는다. 호출부가 "위치를 못 얻었다"를 안내로 처리한다.
 * 권한을 새로 묻지는 않는다 — 촬영과 장소 검색에서 이미 물었고, 등록 직전에 창을 띄우면
 * 사용자는 무엇 때문인지 알 수 없다.
 */
async function readCaptureCoordinate(): Promise<Coordinate | null> {
  const result = await readCurrentCoordinate();
  return 'coordinate' in result ? result.coordinate : null;
}

/** 잠시 기다린다. 상태 조회 사이 간격에 쓴다. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * AI 처리가 끝날 때까지 상태를 물어본다.
 *
 * 접수 직후 핀은 `PENDING`이고 그 상태에서는 상세 조회가 되지 않는다. `ACTIVE`가 되면
 * 공개할 수 있어 화면이 상세로 넘어간다.
 *
 * 끝나는 상태가 셋이고 사용자가 할 일이 다르다.
 * - `ACTIVE` 공개됨. 그대로 진행한다
 * - `REJECTED` 검수 기준 미충족. 자동 재처리가 없으므로 재촬영을 안내한다
 * - `FAILED` AI·시스템 오류. 다시 시도해 볼 수 있다
 *
 * 최대 대기 시간을 넘기면 포기한다. 실패가 아니라 접수는 됐으므로 그 사실만 알린다.
 */
async function waitForCompletion(
  pinId: PinId,
  alive: () => boolean,
  set: (partial: Partial<PinPublishState>) => void,
): Promise<void> {
  const deadline = Date.now() + STATUS_POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    await sleep(STATUS_POLL_INTERVAL_MS);
    if (!alive()) return;

    const { videoStatus } = await getPinVideoStatus(pinId);
    if (!alive()) return;

    logPublish('상태 확인', { videoStatus });
    set({ videoStatus });

    if (videoStatus === 'ACTIVE') {
      set({ phase: 'done' });
      return;
    }

    if (videoStatus === 'REJECTED') {
      set({
        phase: 'idle',
        error: '영상이 검수를 통과하지 못했어요. 다시 촬영해 주세요.',
        retryable: false,
      });
      return;
    }

    if (videoStatus === 'FAILED') {
      set({
        phase: 'idle',
        error: '영상을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.',
        // 시스템 오류라 같은 영상으로 다시 등록해 볼 수 있다.
        retryable: true,
      });
      return;
    }
  }

  if (!alive()) return;

  set({
    phase: 'idle',
    error: '처리가 오래 걸리고 있어요. 등록은 접수됐으니 잠시 후 확인해 주세요.',
    retryable: false,
  });
}

/** 발급받은 티켓. 재시도할 때 같은 키를 쓰기 위해 화면 밖에 둔다. */
let ticket: VideoUploadTicket | null = null;
/** 진행 중인 업로드를 취소하기 위한 손잡이. */
let cancelUpload: (() => void) | null = null;
/** 취소된 시도의 결과가 상태를 되살리지 못하게 막는다. */
let attempt = 0;

const initialState = {
  phase: 'idle' as VideoUploadPhase,
  progress: 0,
  pinId: null as PinId | null,
  videoStatus: null as PinVideoStatus | null,
  error: null as string | null,
  retryable: false,
};

/**
 * 핀 등록을 발급 → 업로드 → 등록 순서로 진행한다.
 *
 * 업로드가 2xx일 때만 등록 API를 부른다. 재시도할 때는 이미 올린 영상을 다시 올리지 않고
 * 같은 `originalVideoKey`를 재사용한다. 서버는 중복 등록을 409로 거절한다.
 */
export const usePinPublishStore = createStore<PinPublishState>((set) => ({
  ...initialState,

  publish: (draft) => {
    if (!draft.video || !draft.place) return;

    attempt += 1;
    const current = attempt;
    const alive = () => attempt === current;

    set({ error: null, retryable: false, progress: 0 });

    const fileUri = draft.video.uri;

    const run = async () => {
      // 1. 발급 — 이미 받은 티켓이 있으면 재사용한다.
      if (!ticket) {
        set({ phase: 'issuing' });
        const size = await readVideoSize(fileUri);
        logPublish('발급 요청', { contentType: VIDEO_CONTENT_TYPE, fileSize: size });

        const issued = await issueVideoUploadTicket(VIDEO_CONTENT_TYPE, size);
        if (!alive()) return;
        logPublish('발급 완료', {
          originalVideoKey: issued.originalVideoKey,
          expiresAt: issued.expiresAt,
        });
        ticket = issued;

        // 2. 업로드 — 티켓을 새로 받았을 때만 올린다.
        set({ phase: 'uploading' });
        const upload = startVideoUpload(issued, fileUri, (ratio) => {
          if (alive()) set({ progress: ratio });
        });
        cancelUpload = upload.cancel;

        await upload.completed;
        cancelUpload = null;
        if (!alive()) return;
      }

      /*
        3. 등록 — 업로드가 끝난 뒤에만 호출한다.

        촬영 좌표는 찍을 때 함께 저장해 둔 값을 쓴다. 그때 위치를 얻지 못했으면 지금 읽는다 —
        촬영 직후에 등록하는 흐름이라 몇 미터 차이일 뿐이고, 그것마저 실패하면 서버가 거리를
        검증할 수 없으므로 등록을 진행하지 않는다.
      */
      const captured = draft.video?.coordinate ?? (await readCaptureCoordinate());
      if (!alive()) return;
      if (!captured) {
        set({
          phase: 'idle',
          progress: 0,
          error: '현재 위치를 확인하지 못했어요. 위치 권한을 허용한 뒤 다시 시도해 주세요.',
          retryable: true,
        });
        return;
      }

      const body = toRequest(draft, ticket.originalVideoKey, captured);
      if (!body) return;

      set({ phase: 'registering' });
      logPublish('등록 요청', {
        kakaoPlaceId: body.kakaoPlaceId,
        placeName: body.placeName,
        촬영: `${body.latitude}, ${body.longitude}`,
        장소: `${body.kakaoPlaceLatitude}, ${body.kakaoPlaceLongitude}`,
        crowdLevel: body.crowdLevel,
        태그: body.tags?.length ?? 0,
      });

      const result = await createPin(body);
      if (!alive()) return;
      logPublish('등록 접수', { pinId: result.pinId, videoStatus: result.videoStatus });

      // 4. 처리 대기 — 접수만 된 상태다. 완료될 때까지 상태를 물어본다.
      set({ phase: 'processing', pinId: result.pinId, videoStatus: result.videoStatus });
      await waitForCompletion(result.pinId, alive, set);
    };

    run().catch((cause: unknown) => {
      cancelUpload = null;
      if (!alive()) return;

      const isApiError = cause instanceof ApiError;
      logPublish('실패', {
        code: isApiError ? cause.code : 'unknown',
        statusCode: isApiError ? cause.statusCode : undefined,
        message: cause instanceof Error ? cause.message : String(cause),
      });
      set({
        phase: 'idle',
        progress: 0,
        error: isApiError
          ? (messageByCode[cause.code] ?? cause.message)
          : cause instanceof Error
            ? cause.message
            : '핀을 등록하지 못했어요',
        // 업로드 실패는 네트워크 문제가 대부분이라 다시 시도할 값이 있다.
        retryable: isApiError ? retryableCodes.has(cause.code) : true,
      });
    });
  },

  cancel: () => {
    attempt += 1;
    cancelUpload?.();
    cancelUpload = null;
    // 취소하면 올려 둔 영상을 쓰지 않으므로 티켓도 버린다.
    ticket = null;
    set(initialState);
  },

  dismissError: () => set({ error: null }),

  reset: () => {
    attempt += 1;
    cancelUpload = null;
    ticket = null;
    set(initialState);
  },
}));
