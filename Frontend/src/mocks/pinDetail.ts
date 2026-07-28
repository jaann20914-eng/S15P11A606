import { ApiError } from '@/api/client';
import type { PinDetail } from '@/types/pin';

/**
 * 게시글 상세 고정 데이터.
 *
 * 백엔드 연동 전까지 화면이 실제 응답과 같은 모양의 데이터를 받아 렌더링하도록 하는 것이 목적이다.
 * 로딩·오류·상태별 분기를 전부 여기서 재현할 수 있어야 하므로 시나리오를 `pinId`에 매핑해 둔다.
 *
 * 화면에서 확인하는 법: `/pin/1` ~ `/pin/4`로 이동한다. 그 밖의 id는 조회 실패 화면이 뜬다.
 */

/** 실제 네트워크처럼 로딩 상태를 볼 수 있도록 주는 지연. */
const MOCK_LATENCY_MS = 400;

export type PinDetailScenario = 'locked' | 'purchased' | 'rated' | 'mine' | 'notFound';

/** `pinId` → 시나리오. 표에 없는 id는 실제 서버와 같이 조회 실패로 처리한다. */
const scenarioByPinId: Record<number, PinDetailScenario> = {
  1: 'locked',
  2: 'purchased',
  3: 'rated',
  4: 'mine',
};

export function resolvePinDetailScenario(pinId: number): PinDetailScenario {
  return scenarioByPinId[pinId] ?? 'notFound';
}

function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function hoursLater(hours: number): string {
  return new Date(Date.now() + hours * 3_600_000).toISOString();
}

/**
 * 모든 시나리오가 공유하는 본문.
 *
 * `thumbnailUrl`·`videoUrl`은 빈 문자열이다. 아직 Object Storage URL 규격이 없어서
 * 화면이 번들에 포함된 디자인 시안 이미지로 폴백하도록 두었다.
 * 실제 URL이 정해지면 이 두 값만 채우면 화면은 그대로 동작한다.
 */
function createBaseDetail(): PinDetail {
  return {
    pinId: 1,
    placeId: 11,
    placeName: '바나프레소 역삼점',
    address: '서울 광진구 동일로 60길 47 1층 (군자동)',
    videoUrl: '',
    thumbnailUrl: '',
    memo: '2층 창가석에 앉아있습니다. 지금 사람이 엄청 많네요. 혹시 노트북 자리가 필요하신 분이 계시다면 3시반까지는 채팅 편하게 주세요.',
    tags: ['좌석없음', '콘센트', '조용함'],
    crowdLevel: 'CROWDED',
    capturedAt: minutesAgo(1),
    expiresAt: hoursLater(3),
    status: 'ACTIVE',
    author: {
      nickname: '역삼동 익명러',
      viewTemperature: 92,
      trustPercentile: 12,
    },
    viewer: {
      isMine: false,
      isPurchased: false,
      myRating: null,
      chatRoomId: null,
      chatStatus: null,
    },
  };
}

function createFixture(scenario: Exclude<PinDetailScenario, 'notFound'>): PinDetail {
  const base = createBaseDetail();

  switch (scenario) {
    /** 타인 핀 · 미열람. 블러와 결제 버튼이 보인다. */
    case 'locked':
      return base;

    /** 열람 완료 · 평가 전. 블러가 풀리고 평가 버튼과 채팅 요청이 보인다. */
    case 'purchased':
      return {
        ...base,
        viewer: { ...base.viewer, isPurchased: true },
      };

    /** 열람 · 평가 완료 · 채팅 수락 대기. 적립 안내와 "수락 대기"가 보인다. */
    case 'rated':
      return {
        ...base,
        viewer: {
          ...base.viewer,
          isPurchased: true,
          myRating: 'HELPFUL',
          chatRoomId: 7,
          chatStatus: 'PENDING',
        },
      };

    /** 내가 쓴 핀. 결제·채팅·평가 대신 삭제가 보인다. */
    case 'mine':
      return {
        ...base,
        memo: '창가 쪽은 아직 자리 있어요. 콘센트는 벽면에만 있습니다.',
        author: { nickname: '나', viewTemperature: 88, trustPercentile: null },
        viewer: { ...base.viewer, isMine: true, isPurchased: true },
      };
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 실제 API와 같은 시그니처. 실패 시에도 `ApiError`를 던져 화면 분기가 동일하게 동작한다. */
export async function fetchMockPinDetail(pinId: number): Promise<PinDetail> {
  await delay(MOCK_LATENCY_MS);

  const scenario = resolvePinDetailScenario(pinId);

  if (scenario === 'notFound') {
    throw new ApiError(404, 'PIN_NOT_FOUND', '조회할 수 있는 핀이 없습니다.');
  }

  return { ...createFixture(scenario), pinId };
}

/**
 * 삭제 목업. 저장소가 없으므로 성공/실패 판정만 재현한다.
 * 내 핀이 아닌 id로 부르면 실제 서버와 같은 403을 던져 화면 분기를 확인할 수 있다.
 */
export async function deleteMockPin(pinId: number): Promise<void> {
  await delay(MOCK_LATENCY_MS);

  if (resolvePinDetailScenario(pinId) !== 'mine') {
    throw new ApiError(403, 'PIN_DELETE_FORBIDDEN', '내가 작성한 영상핀만 삭제할 수 있어요.');
  }
}

/** "이미 떠났어요" 목업. 실제 API는 핀에 연결된 채팅방 id 목록을 돌려준다. */
export async function leaveMockPinChats(pinId: number): Promise<number[]> {
  await delay(MOCK_LATENCY_MS);

  if (resolvePinDetailScenario(pinId) !== 'mine') {
    throw new ApiError(403, 'CHAT_PIN_LEAVE_FORBIDDEN', '해당 핀의 채팅방에서 나갈 권한이 없어요.');
  }

  return [7];
}
