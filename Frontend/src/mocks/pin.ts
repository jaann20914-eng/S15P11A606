import { ApiError } from '@/api/client';
import type {
  PinDeleteResult,
  PinDetailResponse,
  PinEvaluationResult,
  PinRating,
  PinUnlockResult,
} from '@/types/pin';
import type { PinCreateRequest, PinCreateResult, VideoUploadTicket } from '@/types/pinCreate';

/**
 * 게시글 상세 고정 데이터.
 *
 * 백엔드에 pin 도메인이 아직 없어(2026-07-28 dev 기준 places만 구현) 목업으로 화면을 돌린다.
 * 필드와 오류 코드는 상세 조회 명세를 그대로 따르므로 서버가 생기면 값만 바뀐다.
 *
 * 화면에서 확인하는 법: `/pin/1` ~ `/pin/4`로 이동한다. 그 밖의 id는 조회 실패 화면이 뜬다.
 */

/** 실제 네트워크처럼 로딩 상태를 볼 수 있도록 주는 지연. */
export const MOCK_LATENCY_MS = 400;

export type PinDetailScenario = 'preview' | 'unlocked' | 'evaluated' | 'owner' | 'notFound';

/** `pinId` → 시나리오. 표에 없는 id는 실제 서버와 같이 조회 실패로 처리한다. */
const scenarioByPinId: Record<number, PinDetailScenario> = {
  1: 'preview',
  2: 'unlocked',
  3: 'evaluated',
  4: 'owner',
  5: 'preview',
  6: 'owner',
};

/** 결제 실패 화면을 확인하기 위한 핀. 상세는 정상이지만 잠금 해제에서 잔액 부족이 난다. */
const INSUFFICIENT_CREDIT_PIN_IDS = new Set([5]);

/** 삭제 실패 화면을 확인하기 위한 내 핀. 삭제 요청에서 409가 난다. */
const DELETE_NOT_ALLOWED_PIN_IDS = new Set([6]);

export function resolvePinDetailScenario(pinId: number): PinDetailScenario {
  return scenarioByPinId[pinId] ?? 'notFound';
}

/**
 * 모든 시나리오가 공유하는 본문.
 *
 * `videoUrl`·`previewUrl`은 빈 문자열이다. Object Storage signed URL이 아직 없어서
 * 화면이 번들에 포함된 디자인 시안 이미지로 폴백하도록 두었다.
 */
function createBaseDetail(): PinDetailResponse {
  return {
    pinId: 1,
    place: {
      placeId: 11,
      name: '바나프레소 역삼점',
      address: '서울 광진구 동일로 60길 47 1층 (군자동)',
    },
    authorViewAngle: 92,
    authorNickname: '역삼동 익명러',
    createdAt: new Date(Date.now() - 40_000).toISOString(),
    crowdLevel: 'WAGLE',
    detailLocation: '2층 창가석',
    memo: '2층 창가석에 앉아있습니다. 지금 사람이 엄청 많네요. 혹시 노트북 자리가 필요하신 분이 계시다면 3시반까지는 채팅 편하게 주세요.',
    tags: ['좌석없음', '콘센트', '조용함'],
    videoAccess: 'PREVIEW_BLURRED',
    isEvaluated: null,
    videoUrl: null,
    previewUrl: '',
    canRequestChat: false,
    chatRequestState: 'NONE',
  };
}

function createFixture(scenario: Exclude<PinDetailScenario, 'notFound'>): PinDetailResponse {
  const base = createBaseDetail();

  switch (scenario) {
    /** 미구매. 블러 미리보기와 결제 버튼이 보인다. */
    case 'preview':
      return base;

    /** 열람 완료 · 평가 전. 평가 버튼과 채팅 요청이 보인다. */
    case 'unlocked':
      return {
        ...base,
        videoAccess: 'UNLOCKED',
        isEvaluated: false,
        videoUrl: '',
        previewUrl: null,
        canRequestChat: true,
      };

    /** 열람 · 평가 완료 · 채팅 수락 대기. */
    case 'evaluated':
      return {
        ...base,
        videoAccess: 'UNLOCKED',
        isEvaluated: true,
        videoUrl: '',
        previewUrl: null,
        canRequestChat: false,
        chatRequestState: 'PENDING',
      };

    /** 내가 쓴 핀. 결제·채팅·평가 대신 수정·삭제·떠났어요가 보인다. */
    case 'owner':
      return {
        ...base,
        authorViewAngle: 320,
        authorNickname: '나',
        memo: '창가 쪽은 아직 자리 있어요. 콘센트는 벽면에만 있습니다.',
        videoAccess: 'OWNER',
        isEvaluated: null,
        videoUrl: '',
        previewUrl: null,
      };
  }
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 실제 API와 같은 시그니처. 실패 시에도 `ApiError`를 던져 화면 분기가 동일하게 동작한다. */
export async function fetchMockPinDetail(pinId: number): Promise<PinDetailResponse> {
  await delay(MOCK_LATENCY_MS);

  const scenario = resolvePinDetailScenario(pinId);

  if (scenario === 'notFound') {
    throw new ApiError(404, 'PIN_NOT_FOUND', '조회할 수 있는 핀이 없습니다.');
  }

  return { ...createFixture(scenario), pinId };
}

/** 목업 지갑 잔액. 결제하면 줄고 평가 보상으로 늘어난다. */
let mockCreditBalance = 12;

/** 이번 세션에서 평가한 핀. 중복 평가 409를 재현한다. */
const evaluatedPinIds = new Set<number>();

/**
 * 평가 등록 목업.
 * 권한 없음·본인 핀·중복 평가를 실제 서버와 같은 코드로 실패하게 만든다.
 */
export async function evaluateMockPin(pinId: number, rating: PinRating): Promise<PinEvaluationResult> {
  await delay(MOCK_LATENCY_MS);

  const scenario = resolvePinDetailScenario(pinId);

  if (scenario === 'notFound') {
    throw new ApiError(404, 'PIN_NOT_FOUND', '조회할 수 있는 핀이 없습니다.');
  }

  // 작성자 본인과 미열람자는 평가 대상이 아니다. 결제로 열람했으면 평가할 수 있다.
  if (scenario === 'owner' || (scenario === 'preview' && !unlockedPinIds.has(pinId))) {
    throw new ApiError(403, 'PIN_EVALUATION_FORBIDDEN', '이 핀을 평가할 수 없습니다.');
  }

  if (scenario === 'evaluated' || evaluatedPinIds.has(pinId)) {
    throw new ApiError(409, 'PIN_ALREADY_EVALUATED', '이미 평가한 핀입니다.');
  }

  evaluatedPinIds.add(pinId);
  mockCreditBalance += 1;

  return {
    evaluationId: evaluatedPinIds.size,
    pinId,
    rating,
    rewardCredit: 1,
    createdAt: new Date().toISOString(),
  };
}

/** 멱등성 키 → 이미 처리한 결과. 같은 키로 다시 부르면 차감 없이 그대로 돌려준다. */
const unlockResultsByKey = new Map<string, PinUnlockResult>();

/**
 * 이번 세션에서 결제로 열람한 핀.
 *
 * 시나리오 표는 고정이라 결제 후에도 `preview`로 남는다. 그 상태로는 평가와 채팅 요청이
 * 403으로 막혀 결제 다음 흐름을 확인할 수 없다. 실제 서버는 결제를 기억하므로 목업도 기억한다.
 */
const unlockedPinIds = new Set<number>();

/** 결제로 열람한 핀인지. 평가·채팅 요청 목업이 권한을 판정할 때 쓴다. */
export function isMockPinUnlocked(pinId: number): boolean {
  return unlockedPinIds.has(pinId);
}

/**
 * 잠금 해제 목업.
 * 멱등성 키 재사용·잔액 부족·중복 구매까지 실제 서버와 같은 코드로 실패하게 만든다.
 */
export async function unlockMockPin(pinId: number, idempotencyKey: string): Promise<PinUnlockResult> {
  await delay(MOCK_LATENCY_MS);

  if (!idempotencyKey) {
    throw new ApiError(400, 'IDEMPOTENCY_KEY_REQUIRED', '멱등성 키가 필요합니다.');
  }

  const cached = unlockResultsByKey.get(idempotencyKey);
  if (cached) {
    if (cached.pinId !== pinId) {
      throw new ApiError(409, 'IDEMPOTENCY_KEY_CONFLICT', '동일한 멱등성 키가 다른 요청에 사용되었습니다.');
    }
    // 같은 키·같은 요청은 다시 차감하지 않고 새 URL만 발급한다.
    return { ...cached, creditCharged: 0 };
  }

  const scenario = resolvePinDetailScenario(pinId);
  if (scenario === 'notFound') {
    throw new ApiError(404, 'PIN_NOT_FOUND', '조회할 수 있는 핀이 없습니다.');
  }

  if (INSUFFICIENT_CREDIT_PIN_IDS.has(pinId)) {
    throw new ApiError(409, 'INSUFFICIENT_CREDIT', '크레딧이 부족합니다.');
  }

  // 작성자와 이미 구매한 사용자는 차감하지 않는다.
  const charged = scenario === 'preview' ? 3 : 0;
  mockCreditBalance -= charged;

  const result: PinUnlockResult = {
    pinId,
    creditCharged: charged,
    creditBalance: mockCreditBalance,
    // signed URL이 없어 빈 문자열이다. 화면이 시안 이미지로 폴백한다.
    videoUrl: '',
    accessGranted: true,
  };

  unlockResultsByKey.set(idempotencyKey, result);
  unlockedPinIds.add(pinId);
  return result;
}

/** 등록 목업이 발급할 다음 핀 id. */
let nextMockPinId = 100;

/** 등록에 이미 쓴 영상 키. 같은 키로 다시 등록하면 409가 난다. */
const usedVideoKeys = new Set<string>();

/** 발급한 업로드 티켓 수. 키를 매번 다르게 만들기 위해서만 쓴다. */
let issuedUploadCount = 0;

/**
 * Presigned POST 발급 목업.
 *
 * 실제 서명을 만들 수 없으므로 업로드는 `videoUploadTask`가 흉내낸다.
 * 키 형식은 명세 예시를 따른다.
 */
export async function issueMockVideoUpload(
  contentType: string,
  contentLength: number,
): Promise<VideoUploadTicket> {
  await delay(MOCK_LATENCY_MS);

  if (!contentType) {
    throw new ApiError(400, 'INVALID_REQUEST', '업로드 요청이 올바르지 않습니다.');
  }

  const serial = ++issuedUploadCount;
  const originalVideoKey = `pins/original/1/mock-${serial}-${contentLength}.mp4`;

  return {
    // Presigned POST라 URL은 버킷 주소만이고 객체 경로는 fields.key가 갖는다.
    uploadUrl: 'https://storage.example.com',
    originalVideoKey,
    fields: {
      key: originalVideoKey,
      policy: 'mock-policy',
      'x-amz-algorithm': 'AWS4-HMAC-SHA256',
      'x-amz-signature': 'mock-signature',
    },
  };
}

/**
 * 핀 등록 목업.
 *
 * 서버는 202로 접수만 하고 AI 검수는 비동기로 돈다. 목업도 `PENDING`을 돌려준다.
 *
 * 화면에서 오류를 확인하는 법: 상세 위치에 아래 문구를 넣는다.
 * `범위밖` → 422 위치 초과, `영상오류` → 422 영상 접근 불가,
 * `한도초과` → 429 일일 한도, `실패` → 500.
 */
export async function createMockPin(body: PinCreateRequest): Promise<PinCreateResult> {
  await delay(MOCK_LATENCY_MS);

  if (!body.originalVideoKey) {
    throw new ApiError(400, 'INVALID_REQUEST', '핀 등록 요청이 올바르지 않습니다.');
  }

  const hint = body.detailLocation ?? '';

  if (hint.includes('범위밖')) {
    throw new ApiError(422, 'LOCATION_OUT_OF_RANGE', '선택한 장소와 촬영 위치가 너무 멉니다.');
  }

  if (hint.includes('영상오류')) {
    throw new ApiError(422, 'VIDEO_NOT_ACCESSIBLE', '영상에 접근할 수 없습니다.');
  }

  if (hint.includes('한도초과')) {
    throw new ApiError(429, 'DAILY_PIN_LIMIT_EXCEEDED', '오늘 등록 가능한 핀 수를 초과했습니다.');
  }

  if (hint.includes('실패')) {
    throw new ApiError(500, 'PIN_CREATE_FAILED', '핀 등록 중 오류가 발생했습니다.');
  }

  // 같은 영상으로 두 번 등록하는 것을 막는다.
  if (usedVideoKeys.has(body.originalVideoKey)) {
    throw new ApiError(409, 'VIDEO_ALREADY_REGISTERED', '이미 핀 등록에 사용된 영상입니다.');
  }

  usedVideoKeys.add(body.originalVideoKey);
  return { pinId: nextMockPinId++, videoStatus: 'PENDING' };
}

/** 이미 삭제한 핀 → 그때 돌려준 결과. 재요청 시 같은 값을 준다(멱등). */
const deleteResultsByPinId = new Map<number, PinDeleteResult>();

/**
 * 삭제 목업.
 * 권한 없음·삭제 불가 상태·재요청 멱등성을 실제 서버와 같은 코드로 재현한다.
 */
export async function deleteMockPin(pinId: number): Promise<PinDeleteResult> {
  await delay(MOCK_LATENCY_MS);

  const cached = deleteResultsByPinId.get(pinId);
  if (cached) return cached;

  const scenario = resolvePinDetailScenario(pinId);

  if (scenario === 'notFound') {
    throw new ApiError(404, 'PIN_NOT_FOUND', '조회할 수 있는 핀이 없습니다.');
  }

  if (scenario !== 'owner') {
    throw new ApiError(403, 'PIN_DELETE_FORBIDDEN', '핀을 삭제할 권한이 없습니다.');
  }

  if (DELETE_NOT_ALLOWED_PIN_IDS.has(pinId)) {
    throw new ApiError(409, 'PIN_DELETE_NOT_ALLOWED', '현재 상태에서는 핀을 삭제할 수 없습니다.');
  }

  const result: PinDeleteResult = {
    pinId,
    status: 'DELETED',
    closedChatRoomIds: [1],
    deletedAt: new Date().toISOString(),
  };

  deleteResultsByPinId.set(pinId, result);
  return result;
}
