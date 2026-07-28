import { ApiError } from '@/api/client';
import type { PinDetailResponse, PinUnlockResult } from '@/types/pin';

/**
 * 게시글 상세 고정 데이터.
 *
 * 백엔드에 pin 도메인이 아직 없어(2026-07-28 dev 기준 places만 구현) 목업으로 화면을 돌린다.
 * 필드와 오류 코드는 상세 조회 명세를 그대로 따르므로 서버가 생기면 값만 바뀐다.
 *
 * 화면에서 확인하는 법: `/pin/1` ~ `/pin/4`로 이동한다. 그 밖의 id는 조회 실패 화면이 뜬다.
 */

/** 실제 네트워크처럼 로딩 상태를 볼 수 있도록 주는 지연. */
const MOCK_LATENCY_MS = 400;

export type PinDetailScenario = 'preview' | 'unlocked' | 'evaluated' | 'owner' | 'notFound';

/** `pinId` → 시나리오. 표에 없는 id는 실제 서버와 같이 조회 실패로 처리한다. */
const scenarioByPinId: Record<number, PinDetailScenario> = {
  1: 'preview',
  2: 'unlocked',
  3: 'evaluated',
  4: 'owner',
  5: 'preview',
};

/** 결제 실패 화면을 확인하기 위한 핀. 상세는 정상이지만 잠금 해제에서 잔액 부족이 난다. */
const INSUFFICIENT_CREDIT_PIN_IDS = new Set([5]);

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
        authorViewAngle: 88,
        authorNickname: '나',
        memo: '창가 쪽은 아직 자리 있어요. 콘센트는 벽면에만 있습니다.',
        videoAccess: 'OWNER',
        isEvaluated: null,
        videoUrl: '',
        previewUrl: null,
      };
  }
}

function delay(ms: number): Promise<void> {
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

/** 멱등성 키 → 이미 처리한 결과. 같은 키로 다시 부르면 차감 없이 그대로 돌려준다. */
const unlockResultsByKey = new Map<string, PinUnlockResult>();

/** 목업 지갑 잔액. 결제할 때마다 줄어든다. */
let mockCreditBalance = 12;

/**
 * 잠금 해제 목업.
 * 멱등성 키 재사용·잔액 부족·중복 구매까지 실제 서버와 같은 코드로 실패하게 만든다.
 */
export async function unlockMockPin(
  pinId: number,
  idempotencyKey: string,
): Promise<PinUnlockResult> {
  await delay(MOCK_LATENCY_MS);

  if (!idempotencyKey) {
    throw new ApiError(400, 'IDEMPOTENCY_KEY_REQUIRED', '멱등성 키가 필요합니다.');
  }

  const cached = unlockResultsByKey.get(idempotencyKey);
  if (cached) {
    if (cached.pinId !== pinId) {
      throw new ApiError(
        409,
        'IDEMPOTENCY_KEY_CONFLICT',
        '동일한 멱등성 키가 다른 요청에 사용되었습니다.',
      );
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
  return result;
}

/**
 * 삭제 목업. 저장소가 없으므로 성공/실패 판정만 재현한다.
 * 내 핀이 아닌 id로 부르면 실제 서버와 같은 403을 던져 화면 분기를 확인할 수 있다.
 */
export async function deleteMockPin(pinId: number): Promise<void> {
  await delay(MOCK_LATENCY_MS);

  if (resolvePinDetailScenario(pinId) !== 'owner') {
    throw new ApiError(403, 'PIN_DELETE_FORBIDDEN', '내가 작성한 영상핀만 삭제할 수 있어요.');
  }
}

/** "이미 떠났어요" 목업. 실제 API는 핀에 연결된 채팅방 id 목록을 돌려준다. */
export async function leaveMockPinChats(pinId: number): Promise<number[]> {
  await delay(MOCK_LATENCY_MS);

  if (resolvePinDetailScenario(pinId) !== 'owner') {
    throw new ApiError(403, 'CHAT_PIN_LEAVE_FORBIDDEN', '해당 핀의 채팅방에서 나갈 권한이 없어요.');
  }

  return [7];
}
