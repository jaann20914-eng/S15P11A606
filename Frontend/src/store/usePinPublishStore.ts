import { ApiError } from '@/api/client';
import { createPin } from '@/api/pin/create';
import { getPinVideoStatus } from '@/api/pin/status';
import { updatePin } from '@/api/pin/update';
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
import { hasPinUpdate, toPinUpdateRequest } from '@/features/pin-create/pinUpdateRequest';
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
  /**
   * 이미 올린 핀을 고친다.
   *
   * `initial`은 화면에 들어올 때 불러온 값이다. 지금 값과 비교해 **달라진 것만** 보낸다.
   * 영상을 다시 찍었으면 등록과 같은 순서(발급 → 업로드)를 거친 뒤 그 키를 함께 보낸다.
   */
  edit: (pinId: PinId, initial: PinDraft, draft: PinDraft) => void;
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
function toRequest(draft: PinDraft, originalVideoKey: string, captured: Coordinate): PinCreateRequest | null {
  /*
    등록은 카카오에서 고른 장소만 받는다. 그 장소가 우리 DB에 없을 수 있고, 서버가 등록
    시점에 만들기 때문이다. 내부 장소는 수정에서만 고를 수 있다.
  */
  if (draft.place?.source !== 'kakao') return null;

  const memo = draft.memo.trim();
  const detailLocation = draft.detailLocation.trim();

  return {
    originalVideoKey,
    kakaoPlaceId: draft.place.kakaoPlaceId,
    placeName: draft.place.name,
    kakaoPlaceLatitude: draft.place.latitude,
    kakaoPlaceLongitude: draft.place.longitude,
    // 주변 조회가 준 값을 그대로 돌려보낸다. 서버가 장소를 처음 저장할 때 쓴다.
    categoryGroupCode: draft.place.categoryGroupCode,
    categoryGroupName: draft.place.categoryGroupName,
    categoryName: draft.place.categoryName,
    phone: draft.place.phone,
    addressName: draft.place.address,
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
  /*
    필수값 누락 · 타입 · 범위 오류. 화면이 미리 막고 있어 실제로는 잘 나오지 않지만, 서버가
    길이 제한을 조이거나 필드가 늘어나면 이 코드로 온다. 원문이 그대로 뜨면 사용자가 무엇을
    고쳐야 하는지 알 수 없다.
  */
  INVALID_REQUEST: '입력한 내용을 다시 확인해 주세요.',
  UNAUTHORIZED: '다시 로그인한 뒤 등록해 주세요.',
  LOCATION_OUT_OF_RANGE: `선택한 장소와 촬영 위치가 너무 멀어요. ${MAX_PLACE_DISTANCE_METERS}m 안의 장소를 골라 주세요.`,
  VIDEO_NOT_ACCESSIBLE: '영상을 올리지 못했어요. 다시 촬영해 주세요.',
  VIDEO_ALREADY_REGISTERED: '이미 등록에 사용한 영상이에요. 다시 촬영해 주세요.',
  INVALID_CROWD_LEVEL: '혼잡 단계를 다시 선택해 주세요.',
  INVALID_UPLOAD_REQUEST: '영상을 올릴 수 없어요. 다시 촬영해 주세요.',
  UPLOAD_URL_ISSUE_FAILED: '영상 업로드를 준비하지 못했어요. 잠시 후 다시 시도해 주세요.',
  DAILY_PIN_LIMIT_EXCEEDED: '오늘 등록할 수 있는 핀 수를 다 썼어요. 내일 다시 시도해 주세요.',
  PIN_CREATE_FAILED: '핀 등록에 실패했어요. 잠시 후 다시 시도해 주세요.',

  // 수정에서만 나오는 것들
  INVALID_PIN_UPDATE_REQUEST: '수정할 내용을 다시 확인해 주세요.',
  PIN_UPDATE_FORBIDDEN: '내가 올린 영상핀만 수정할 수 있어요.',
  PIN_NOT_FOUND: '영상핀을 찾을 수 없어요. 이미 삭제됐거나 만료됐을 수 있어요.',
  PLACE_NOT_FOUND: '선택한 장소를 찾을 수 없어요.',
  PIN_NOT_EDITABLE: '지금은 수정할 수 없는 상태예요. 영상이 공개된 뒤에 고칠 수 있어요.',
  PIN_UPDATE_IN_PROGRESS: '앞서 요청한 영상 교체가 아직 처리 중이에요. 끝난 뒤에 다시 시도해 주세요.',
  PIN_UPDATE_FAILED: '수정하지 못했어요. 잠시 후 다시 시도해 주세요.',
};

/**
 * 서버 응답이 아니라 **기기에서 나가지도 못한** 실패의 표시들.
 *
 * 영상은 우리 서버가 아니라 S3로 바로 올라간다. 그 주소를 못 찾거나 닿지 못하면 여기서 끊기고,
 * 오류 코드가 없어 원문 예외가 그대로 화면에 뜬다 — "Unable to resolve host ..." 같은 문장은
 * 사용자가 무엇을 해야 하는지 알려 주지 않는다.
 *
 * 안드로이드·iOS가 쓰는 문구가 서로 달라 몇 가지를 함께 본다.
 */
const NETWORK_FAILURE_HINTS = [
  'Unable to resolve host',
  'No address associated',
  'Failed to connect',
  'Network request failed',
  'Software caused connection abort',
  'timed out',
];

const NETWORK_FAILURE_MESSAGE =
  '영상 저장소에 연결하지 못했어요. 네트워크를 바꿔(다른 와이파이나 모바일 데이터) 다시 시도해 주세요.';

function isNetworkFailure(cause: unknown): boolean {
  return cause instanceof Error && NETWORK_FAILURE_HINTS.some((hint) => cause.message.includes(hint));
}

/** 다시 시도해서 풀릴 수 있는 실패. 입력을 고쳐야 하는 실패와 구분한다. */
const retryableCodes = new Set([
  'PIN_CREATE_FAILED',
  'PIN_UPDATE_FAILED',
  'UPLOAD_URL_ISSUE_FAILED',
  'NETWORK_ERROR',
]);

/**
 * 다시 시도할 수 있는 실패인지.
 *
 * 코드 목록에 더해 **5xx 전부**를 재시도 가능으로 본다. 서버가 재시작하는 동안의 502처럼
 * 우리 오류 규격이 없는 응답은 `UNKNOWN_ERROR`로 와서 목록에 안 걸렸고, 영상 업로드까지
 * 끝낸 등록이 "다시 시도" 없이 막혔다 — 처음부터 다시 찍게 만들었다(2026-08-05).
 * 5xx는 입력 문제가 아니라 서버 쪽 일시 장애라 잠시 뒤 다시 보내면 된다.
 */
function isRetryable(cause: ApiError): boolean {
  return retryableCodes.has(cause.code) || cause.statusCode >= 500;
}

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
      logPublish('등록 완료', { pinId });
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

/**
 * 서명을 뗀 영상 주소.
 *
 * Presigned URL은 부를 때마다 서명이 달라져 그대로 비교할 수 없다. 물음표 앞의 경로가 곧
 * 객체 키라, 그 부분만 보면 같은 영상인지 알 수 있다.
 */
function videoKeyOf(videoUrl: string | null): string | null {
  return videoUrl === null ? null : videoUrl.split('?')[0];
}

/**
 * 영상 교체 결과를 기다린다.
 *
 * 등록과 다른 값을 본다. 교체가 도는 동안에도 기존 영상은 공개 중이라 `videoStatus`는 계속
 * `ACTIVE`다.
 *
 * **진행 상태를 알려 주는 필드가 아직 응답에 없다.** 명세에는 `videoReplacementStatus`가 있지만
 * 상태 조회 응답(`pinId`·`videoStatus`·`videoUrl`·`thumbnailUrl`)에는 담겨 오지 않는다. 그래서
 * 영상 주소가 새 것으로 바뀌는 것을 보고 끝을 판단한다 — 교체가 반영되면 객체 키가 달라진다.
 * 서버가 그 필드를 주기 시작하면 그쪽을 먼저 본다.
 *
 * 실패해도 핀은 살아 있다. 기존 영상이 그대로 남으므로 "수정은 됐고 영상만 안 바뀌었다"로
 * 알린다 — 등록 실패와 달리 처음부터 다시 할 일이 아니다.
 */
async function waitForReplacement(
  pinId: PinId,
  alive: () => boolean,
  set: (partial: Partial<PinPublishState>) => void,
): Promise<void> {
  const deadline = Date.now() + STATUS_POLL_TIMEOUT_MS;

  /*
    바뀌었는지 견줄 기준. 교체를 걸기 전의 영상 키다.

    한 번 더 조회해서 얻는다 — 수정 요청의 응답에는 영상 주소가 없다. 이 조회가 실패하면
    기준이 없으므로 키 비교를 쓰지 않고 필드만 본다.
  */
  let previousKey: string | null = null;

  try {
    previousKey = videoKeyOf((await getPinVideoStatus(pinId)).videoUrl);
    logPublish('교체 전 영상', { 키: previousKey ?? '없음' });
  } catch {
    logPublish('교체 전 영상 조회 실패', { 비고: '주소 비교 없이 기다린다' });
  }

  while (Date.now() < deadline) {
    await sleep(STATUS_POLL_INTERVAL_MS);
    if (!alive()) return;

    const { videoReplacementStatus, videoUrl } = await getPinVideoStatus(pinId);
    if (!alive()) return;

    const currentKey = videoKeyOf(videoUrl);

    logPublish('교체 상태', {
      videoReplacementStatus: videoReplacementStatus ?? '없음(응답에 없는 필드)',
      영상바뀜: previousKey !== null && currentKey !== null && currentKey !== previousKey,
    });

    // 필드가 없어도 영상이 새 것으로 바뀌면 반영된 것이다.
    if (previousKey !== null && currentKey !== null && currentKey !== previousKey) {
      logPublish('영상 교체 완료', { pinId, 판단: '영상 주소가 바뀜' });
      set({ phase: 'done' });
      return;
    }

    if (videoReplacementStatus === 'PASS') {
      logPublish('영상 교체 완료', { pinId, 판단: 'videoReplacementStatus' });
      set({ phase: 'done' });
      return;
    }

    if (videoReplacementStatus === 'FAIL') {
      set({
        phase: 'idle',
        error: '새 영상이 검수를 통과하지 못했어요. 기존 영상은 그대로 남아 있어요.',
        retryable: false,
      });
      return;
    }

    if (videoReplacementStatus === 'FAILED') {
      set({
        phase: 'idle',
        error: '영상을 교체하지 못했어요. 기존 영상은 그대로 남아 있어요.',
        retryable: true,
      });
      return;
    }
  }

  if (!alive()) return;

  /*
    시간이 다 됐는데 영상이 그대로다.

    검수에서 걸러진 것과 아직 처리 중인 것을 구분할 수 없다 — 그 차이를 알려 주는 필드가 응답에
    없기 때문이다. 그래서 둘 다 아우르는 문구를 쓴다. 기존 영상은 그대로 공개 중이므로 사용자가
    급히 할 일은 없다.
  */
  set({
    phase: 'idle',
    error:
      '새 영상이 아직 반영되지 않았어요. 검수에 걸렸거나 처리가 늦어지는 중이니 잠시 후 다시 확인해 주세요. 기존 영상은 그대로 남아 있어요.',
    retryable: false,
  });
}

/**
 * 발급받은 티켓. 재시도할 때 같은 영상을 두 번 올리지 않으려고 화면 밖에 둔다.
 *
 * 다만 **아무 때나 재사용하면 안 된다.** 키는 한 번만 쓸 수 있고, 등록이 접수되는 순간 그 핀의
 * 것이 된다. 그래서 접수에 성공하면 곧바로 비우고(아래 3번), 새로 찍은 영상에는 다시 발급받는다.
 */
let ticket: VideoUploadTicket | null = null;

/**
 * 티켓이 어느 파일의 것인지.
 *
 * 이 값을 두지 않았을 때, 검수에서 걸려 다시 찍어도 예전 티켓을 그대로 써서 새 영상은 올라가지
 * 않고 이미 쓴 키로 등록을 시도했다 — 서버가 "이미 등록에 사용한 영상"으로 거절한다.
 */
let ticketFileUri: string | null = null;
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
      // 1. 발급 — **같은 파일**로 다시 시도하는 경우에만 앞서 받은 티켓을 재사용한다.
      if (!ticket || ticketFileUri !== fileUri) {
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
        ticketFileUri = fileUri;

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

      /*
        접수된 순간 이 키는 그 핀의 것이 된다. 검수에서 걸리더라도 되돌아오지 않는다.
        여기서 비워 두지 않으면 다음 시도가 쓸 수 없는 키를 들고 간다.
      */
      ticket = null;
      ticketFileUri = null;

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
          : isNetworkFailure(cause)
            ? NETWORK_FAILURE_MESSAGE
            : cause instanceof Error
              ? cause.message
              : '핀을 등록하지 못했어요',
        // 업로드 실패는 네트워크 문제가 대부분이라 다시 시도할 값이 있다.
        retryable: isApiError ? isRetryable(cause) : true,
      });
    });
  },

  edit: (pinId, initial, draft) => {
    attempt += 1;
    const current = attempt;
    const alive = () => attempt === current;

    set({ error: null, retryable: false, progress: 0 });

    /*
      영상을 다시 찍었을 때만 교체다.

      수정 화면은 기존 영상을 파일로 들고 있지 않다(서버에 있다). 그래서 `draft.video`에 값이
      있다는 것은 곧 "이번에 새로 찍었다"는 뜻이다.
    */
    const replacement = draft.video;

    const run = async () => {
      // 1~2. 영상을 바꿀 때만 발급하고 올린다. 글자만 고쳤으면 이 단계가 통째로 없다.
      if (replacement && (!ticket || ticketFileUri !== replacement.uri)) {
        set({ phase: 'issuing' });
        const size = await readVideoSize(replacement.uri);
        logPublish('교체 발급 요청', { contentType: VIDEO_CONTENT_TYPE, fileSize: size });

        const issued = await issueVideoUploadTicket(VIDEO_CONTENT_TYPE, size);
        if (!alive()) return;
        ticket = issued;
        ticketFileUri = replacement.uri;

        set({ phase: 'uploading' });
        const upload = startVideoUpload(issued, replacement.uri, (ratio) => {
          if (alive()) set({ progress: ratio });
        });
        cancelUpload = upload.cancel;

        await upload.completed;
        cancelUpload = null;
        if (!alive()) return;
      }

      // 3. 수정 — 바뀐 것만 담는다. 보낼 것이 없으면 요청하지 않는다(서버가 400으로 막는다).
      const body = toPinUpdateRequest(initial, draft, replacement ? ticket?.originalVideoKey : undefined);
      if (!hasPinUpdate(body)) {
        set({ phase: 'done', pinId });
        return;
      }

      set({ phase: 'registering' });
      logPublish('수정 요청', { pinId, 필드: Object.keys(body) });

      const result = await updatePin(pinId, body);
      if (!alive()) return;

      // 등록과 같다 — 보낸 키는 이 핀의 것이 되므로 다음 시도가 물려받지 않게 비운다.
      ticket = null;
      ticketFileUri = null;
      logPublish('수정 완료', {
        updatedFields: result.updatedFields,
        videoReplacementStatus: result.videoReplacementStatus ?? '없음',
      });

      /*
        4. 영상을 바꿨으면 검수가 끝날 때까지 기다린다.

        글자만 고쳤으면 그 자리에서 끝이다. 서버가 곧바로 반영하고 200을 준다.
      */
      if (result.videoReplacementStatus == null) {
        set({ phase: 'done', pinId, videoStatus: result.videoStatus });
        return;
      }

      set({ phase: 'processing', pinId, videoStatus: result.videoStatus });
      await waitForReplacement(pinId, alive, set);
    };

    run().catch((cause: unknown) => {
      cancelUpload = null;
      if (!alive()) return;

      const isApiError = cause instanceof ApiError;
      logPublish('수정 실패', {
        code: isApiError ? cause.code : 'unknown',
        statusCode: isApiError ? cause.statusCode : undefined,
        message: cause instanceof Error ? cause.message : String(cause),
      });

      set({
        phase: 'idle',
        progress: 0,
        error: isApiError
          ? (messageByCode[cause.code] ?? cause.message)
          : isNetworkFailure(cause)
            ? NETWORK_FAILURE_MESSAGE
            : cause instanceof Error
              ? cause.message
              : '영상핀을 수정하지 못했어요',
        retryable: isApiError ? isRetryable(cause) : true,
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
    ticketFileUri = null;
    set(initialState);
  },
}));
