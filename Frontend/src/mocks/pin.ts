import { ApiError } from '@/api/client';
import type {
  PinDeleteResult,
  PinDetailResponse,
  PinEvaluationResult,
  PinId,
  PinRating,
  PinUnlockResult,
} from '@/types/pin';
import type {
  PinCreateRequest,
  PinCreateResult,
  PinStatusResult,
  PinUpdateRequest,
  PinUpdateResult,
  VideoUploadTicket,
} from '@/types/pinCreate';

/**
 * 게시글 상세 고정 데이터.
 *
 * 백엔드에 pin 도메인이 아직 없어(2026-07-28 dev 기준 places만 구현) 목업으로 화면을 돌린다.
 * 필드와 오류 코드는 상세 조회 명세를 그대로 따르므로 서버가 생기면 값만 바뀐다.
 *
 * 화면에서 확인하는 법: `/pin/1` ~ `/pin/6`으로 이동한다. 식별자는 UUID지만 목업이 짧은
 * 번호도 같은 핀으로 받아준다(`resolvePinDetailScenario`). 표에 없는 id는 조회 실패 화면이 뜬다.
 */

/** 실제 네트워크처럼 로딩 상태를 볼 수 있도록 주는 지연. */
export const MOCK_LATENCY_MS = 400;

export type PinDetailScenario = 'preview' | 'unlocked' | 'evaluated' | 'owner' | 'notFound';

/**
 * 목업 핀 식별자.
 *
 * 실제와 같은 UUID 모양으로 만든다. `1`, `2` 같은 숫자 문자열을 쓰면 어딘가에서
 * `Number(pinId)`로 파싱해도 통과해 버려, 실서버에 붙는 순간에야 깨진다.
 */
export function mockPinId(seed: number): PinId {
  return `00000000-0000-4000-8000-${String(seed).padStart(12, '0')}`;
}

/** `pinId` → 시나리오. 표에 없는 id는 실제 서버와 같이 조회 실패로 처리한다. */
const scenarioByPinId: Record<PinId, PinDetailScenario> = {
  [mockPinId(1)]: 'preview',
  [mockPinId(2)]: 'unlocked',
  [mockPinId(3)]: 'evaluated',
  [mockPinId(4)]: 'owner',
  [mockPinId(5)]: 'preview',
  [mockPinId(6)]: 'owner',
};

/** 결제 실패 화면을 확인하기 위한 핀. 상세는 정상이지만 잠금 해제에서 잔액 부족이 난다. */
const INSUFFICIENT_CREDIT_PIN_IDS = new Set([mockPinId(5)]);

/** 삭제 실패 화면을 확인하기 위한 내 핀. 삭제 요청에서 409가 난다. */
const DELETE_NOT_ALLOWED_PIN_IDS = new Set([mockPinId(6)]);

/**
 * 짧은 번호를 목업 식별자로 맞춘다.
 *
 * 주소창에 `/pin/1`처럼 넣어도 같은 핀으로 보게 하려는 편의다. 목업 식별자가 UUID가 되면서
 * 손으로 화면을 확인하기 어려워졌기 때문이다.
 *
 * 모든 진입점에서 한 번씩 거쳐야 한다. 시나리오만 맞추고 넘어가면 잔액 부족·중복 평가처럼
 * 집합으로 기억하는 판정이 짧은 번호를 못 알아본다.
 *
 * 이 편의는 목업 안에만 있다. 타입과 화면은 그대로 문자열을 다룬다.
 */
export function canonicalMockPinId(pinId: PinId): PinId {
  return /^\d{1,6}$/.test(pinId) ? mockPinId(Number(pinId)) : pinId;
}

export function resolvePinDetailScenario(pinId: PinId): PinDetailScenario {
  return scenarioByPinId[canonicalMockPinId(pinId)] ?? 'notFound';
}

/**
 * 목업 핀을 시나리오 표에 추가한다.
 *
 * 다른 목업이 만든 핀도 상세를 열 수 있게 한다. 마이페이지의 "오늘 등록한 영상핀"이 그런
 * 경우다 — 목록에는 있는데 표에 없으면 눌렀을 때 조회 실패 화면이 뜬다.
 */
export function registerMockPinScenario(pinId: PinId, scenario: PinDetailScenario): void {
  scenarioByPinId[canonicalMockPinId(pinId)] = scenario;
}

/**
 * 모든 시나리오가 공유하는 본문.
 *
 * `videoUrl`·`previewUrl`은 빈 문자열이다. Object Storage signed URL이 아직 없어서
 * 화면이 번들에 포함된 디자인 시안 이미지로 폴백하도록 두었다.
 */
function createBaseDetail(): PinDetailResponse {
  return {
    pinId: mockPinId(1),
    place: {
      placeId: 11,
      kakaoPlaceId: '1234567891',
      name: '바나프레소 역삼점',
      latitude: 37.5556,
      longitude: 127.0791,
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
export async function fetchMockPinDetail(pinId: PinId): Promise<PinDetailResponse> {
  // 짧은 번호로 들어와도 표·집합과 같은 키로 맞춘다.
  pinId = canonicalMockPinId(pinId);

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
const evaluatedPinIds = new Set<PinId>();

/**
 * 평가 등록 목업.
 * 권한 없음·본인 핀·중복 평가를 실제 서버와 같은 코드로 실패하게 만든다.
 */
export async function evaluateMockPin(pinId: PinId, rating: PinRating): Promise<PinEvaluationResult> {
  // 짧은 번호로 들어와도 표·집합과 같은 키로 맞춘다.
  pinId = canonicalMockPinId(pinId);

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
const unlockedPinIds = new Set<PinId>();

/** 결제로 열람한 핀인지. 평가·채팅 요청 목업이 권한을 판정할 때 쓴다. */
export function isMockPinUnlocked(pinId: PinId): boolean {
  // 짧은 번호로 들어와도 표·집합과 같은 키로 맞춘다.
  pinId = canonicalMockPinId(pinId);

  return unlockedPinIds.has(pinId);
}

/**
 * 잠금 해제 목업.
 * 멱등성 키 재사용·잔액 부족·중복 구매까지 실제 서버와 같은 코드로 실패하게 만든다.
 */
export async function unlockMockPin(pinId: PinId, idempotencyKey: string): Promise<PinUnlockResult> {
  // 짧은 번호로 들어와도 표·집합과 같은 키로 맞춘다.
  pinId = canonicalMockPinId(pinId);

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
let nextMockPinSeed = 100;

/** 등록에 이미 쓴 영상 키. 같은 키로 다시 등록하면 409가 난다. */
const usedVideoKeys = new Set<string>();

/** 발급 URL의 유효 시간. 실제 값은 서버가 정한다. */
const UPLOAD_URL_TTL_MS = 10 * 60_000;

/** 발급한 업로드 티켓 수. 키를 매번 다르게 만들기 위해서만 쓴다. */
let issuedUploadCount = 0;

/**
 * 업로드 정보 발급 목업.
 *
 * 실제 서명을 만들 수 없으므로 업로드는 `videoUploadTask`가 흉내낸다.
 * 키 형식과 응답 필드는 명세를 따른다 — Presigned PUT이라 폼 필드가 없다.
 */
export async function issueMockVideoUpload(
  contentType: string,
  fileSize: number,
): Promise<VideoUploadTicket> {
  await delay(MOCK_LATENCY_MS);

  if (!contentType) {
    throw new ApiError(400, 'INVALID_UPLOAD_REQUEST', '영상 업로드 정보 발급 요청이 올바르지 않습니다.');
  }

  const serial = ++issuedUploadCount;
  const originalVideoKey = `pins/original/1/mock-${serial}-${fileSize}.mp4`;

  return {
    // Presigned PUT이라 서명이 URL 안에 있다. 목업은 형태만 흉내낸다.
    uploadUrl: `https://storage.example.com/${originalVideoKey}?X-Amz-Signature=mock`,
    originalVideoKey,
    expiresAt: new Date(Date.now() + UPLOAD_URL_TTL_MS).toISOString(),
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

  if (!body.originalVideoKey || !body.kakaoPlaceId || !body.placeName) {
    throw new ApiError(400, 'INVALID_REQUEST', '핀 등록 요청이 올바르지 않습니다.');
  }

  // 좌표 네 개는 모두 필수다. 하나라도 없으면 서버가 거리 검증을 할 수 없다.
  const coordinates = [
    body.latitude,
    body.longitude,
    body.kakaoPlaceLatitude,
    body.kakaoPlaceLongitude,
  ];
  if (coordinates.some((value) => !Number.isFinite(value))) {
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
  return { pinId: mockPinId(nextMockPinSeed++), videoStatus: 'PENDING' };
}

/** 핀별 상태 조회 횟수. 몇 번 물어본 뒤 완료로 바꿔 처리 대기 화면을 확인할 수 있게 한다. */
const statusPollCountByPinId = new Map<PinId, number>();

/** 처리 완료로 바뀌기까지 필요한 조회 횟수. */
const POLLS_UNTIL_COMPLETED = 3;

/**
 * 영상 처리 상태 조회 목업.
 *
 * 실제 AI 처리가 없으므로 몇 번 물어보면 완료로 바꾼다.
 * 등록하지 않은 핀을 물어보면 실제 서버와 같이 404를 던진다.
 */
export async function fetchMockPinVideoStatus(pinId: PinId): Promise<PinStatusResult> {
  // 짧은 번호로 들어와도 표·집합과 같은 키로 맞춘다.
  pinId = canonicalMockPinId(pinId);

  await delay(MOCK_LATENCY_MS);

  const polls = (statusPollCountByPinId.get(pinId) ?? 0) + 1;
  statusPollCountByPinId.set(pinId, polls);
  const settled = polls >= POLLS_UNTIL_COMPLETED;

  /*
    영상 교체가 걸려 있으면 그쪽을 답한다.

    교체 중에도 공개 중인 영상은 그대로이므로 `videoStatus`는 계속 `ACTIVE`다. 새 영상의
    진행은 `videoReplacementStatus`로만 드러난다 — 두 값을 헷갈리면 화면이 "처리 중"에서
    영영 벗어나지 못한다.
  */
  if (replacingPinIds.has(pinId)) {
    if (settled) replacingPinIds.delete(pinId);

    return {
      pinId,
      videoStatus: 'ACTIVE',
      videoUrl: null,
      thumbnailUrl: null,
      videoReplacementStatus: settled ? 'PASS' : 'PENDING',
    };
  }

  return {
    pinId,
    videoStatus: settled ? 'ACTIVE' : 'PENDING',
    // 실제로는 ACTIVE일 때만 Presigned GET URL이 온다. 목업은 줄 것이 없어 비워 둔다.
    videoUrl: null,
    thumbnailUrl: null,
    videoReplacementStatus: null,
  };
}

/** 영상 교체가 진행 중인 핀. 상태 조회가 이 집합을 보고 교체 상태를 답한다. */
const replacingPinIds = new Set<PinId>();

/**
 * 핀 수정 목업.
 *
 * 부분 수정이라 **보낸 필드만** 반영된 것으로 답한다. 영상 키가 실리면 교체 작업이 시작된
 * 것으로 보고 202에 해당하는 결과를 준다.
 *
 * 화면에서 오류를 확인하는 법: 상세 위치에 아래 문구를 넣는다.
 * `권한없음` → 403, `수정불가` → 409 상태 오류, `교체중` → 409 교체 진행 중,
 * `범위밖` → 422 위치 초과.
 */
export async function updateMockPin(
  pinId: PinId,
  body: PinUpdateRequest,
): Promise<PinUpdateResult> {
  pinId = canonicalMockPinId(pinId);

  await delay(MOCK_LATENCY_MS);

  if (resolvePinDetailScenario(pinId) === 'notFound') {
    throw new ApiError(404, 'PIN_NOT_FOUND', '수정할 핀을 찾을 수 없습니다.');
  }

  const fields = Object.keys(body);
  if (fields.length === 0) {
    throw new ApiError(400, 'INVALID_PIN_UPDATE_REQUEST', '핀 수정 요청이 올바르지 않습니다.');
  }

  const hint = body.detailLocation ?? '';

  if (hint.includes('권한없음')) {
    throw new ApiError(403, 'PIN_UPDATE_FORBIDDEN', '해당 핀을 수정할 권한이 없습니다.');
  }

  if (hint.includes('수정불가')) {
    throw new ApiError(409, 'PIN_NOT_EDITABLE', '수정할 수 없는 상태의 핀입니다.');
  }

  if (hint.includes('교체중')) {
    throw new ApiError(409, 'PIN_UPDATE_IN_PROGRESS', '이미 영상 교체 작업이 진행 중입니다.');
  }

  if (hint.includes('범위밖')) {
    throw new ApiError(422, 'LOCATION_OUT_OF_RANGE', '선택한 장소와 촬영 위치가 너무 멉니다.');
  }

  const replacing = body.originalVideoKey !== undefined;
  if (replacing) {
    // 같은 영상을 두 번 쓰는 것은 등록과 같은 이유로 막는다.
    if (usedVideoKeys.has(body.originalVideoKey!)) {
      throw new ApiError(409, 'VIDEO_ALREADY_REGISTERED', '이미 사용된 영상입니다.');
    }
    usedVideoKeys.add(body.originalVideoKey!);

    replacingPinIds.add(pinId);
    statusPollCountByPinId.delete(pinId);
  }

  // 영상 키는 즉시 반영되는 값이 아니라 비동기 처리 대상이다.
  const updatedFields = fields.filter((field) => field !== 'originalVideoKey');

  return {
    pinId,
    videoStatus: 'ACTIVE',
    updatedFields,
    ...(replacing
      ? { videoReplacementStatus: 'PENDING' as const, pendingFields: ['originalVideoKey'] }
      : {}),
  };
}

/** 이미 삭제한 핀 → 그때 돌려준 결과. 재요청 시 같은 값을 준다(멱등). */
const deleteResultsByPinId = new Map<PinId, PinDeleteResult>();

/**
 * 삭제 목업.
 * 권한 없음·삭제 불가 상태·재요청 멱등성을 실제 서버와 같은 코드로 재현한다.
 */
export async function deleteMockPin(pinId: PinId): Promise<PinDeleteResult> {
  // 짧은 번호로 들어와도 표·집합과 같은 키로 맞춘다.
  pinId = canonicalMockPinId(pinId);

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
