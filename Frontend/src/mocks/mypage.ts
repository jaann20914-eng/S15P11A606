import type {
  ActivityLevel,
  CreditEntry,
  CreditPeriod,
  MonthlyActivity,
  MyPin,
  MyProfileSummary,
} from '@/types/mypage';
import { MOCK_LATENCY_MS, delay } from './pin';

/**
 * 마이페이지 고정 데이터.
 *
 * 백엔드에 마이페이지 API가 아직 없어 화면을 이 데이터로 돌린다.
 * 필드는 `types/mypage.ts`를 따르므로 서버가 생기면 값만 바뀐다.
 */

export async function fetchMockProfileSummary(): Promise<MyProfileSummary> {
  await delay(MOCK_LATENCY_MS);
  return { trustAngle: 92.5, creditBalance: 120, todayPinCount: 2 };
}

/**
 * 7월 달력. 2026년 7월 1일은 수요일이라 월요일 시작 달력에서 앞 두 칸이 빈다.
 * 값은 그날 등록한 영상핀 수를 0~3 구간으로 묶은 것이다.
 */
const julyCells: Array<ActivityLevel | null> = [
  null,
  null,
  0,
  0,
  0,
  1,
  0,
  1,
  1,
  0,
  2,
  0,
  3,
  2,
  0,
  0,
  2,
  0,
  1,
  0,
  0,
  0,
  3,
  0,
  2,
  1,
  0,
  0,
  3,
  2,
  3,
  1,
  0,
  null,
  null,
];

export async function fetchMockMonthlyActivity(): Promise<MonthlyActivity> {
  await delay(MOCK_LATENCY_MS);
  return { month: 7, cells: julyCells, pinCount: 14, earnedCredit: 220, viewCount: 97 };
}

/** 오늘 등록한 영상핀. 첫 건은 아직 블러 처리 중이라 상세를 열 수 없다. */
const myPins: MyPin[] = [
  {
    pinId: 101,
    createdAt: '14:05',
    placeName: '바나프레소 역삼점',
    placeAddress: '서울 광진구 동일로 60길 47 1층 (군자동)',
    state: 'PENDING',
  },
  {
    pinId: 1,
    createdAt: '14:00',
    placeName: '바나프레소 역삼점',
    placeAddress: '서울 광진구 동일로 60길 47 1층 (군자동)',
    state: 'PUBLISHED',
  },
  {
    pinId: 2,
    createdAt: '14:00',
    placeName: '바나프레소 역삼점',
    placeAddress: '서울 광진구 동일로 60길 47 1층 (군자동)',
    state: 'PUBLISHED',
  },
  {
    pinId: 3,
    createdAt: '14:00',
    placeName: '바나프레소 역삼점',
    placeAddress: '서울 광진구 동일로 60길 47 1층 (군자동)',
    state: 'PUBLISHED',
  },
];

export async function fetchMockMyPins(): Promise<MyPin[]> {
  await delay(MOCK_LATENCY_MS);
  return myPins;
}

/** 크레딧 내역. 기간 필터를 확인할 수 있게 오늘·이번 주·이번 달 건을 섞어 둔다. */
const creditEntries: Array<CreditEntry & { period: CreditPeriod }> = [
  {
    entryId: 1,
    title: '영상핀 평가 참여',
    occurredAt: '오늘 오후 2:14',
    amount: 1,
    flow: 'EARNED',
    period: 'TODAY',
  },
  {
    entryId: 2,
    title: '성수 연무장길 영상 열람',
    occurredAt: '오늘 오후 1:52',
    amount: -3,
    flow: 'SPENT',
    period: 'TODAY',
  },
  {
    entryId: 3,
    title: '채팅 요청 수락',
    occurredAt: '오늘 오후 7:03',
    amount: 5,
    flow: 'EARNED',
    period: 'TODAY',
  },
  {
    entryId: 4,
    title: '채팅 요청 수락',
    occurredAt: '26.07.23 오후 7:03',
    amount: 5,
    flow: 'EARNED',
    period: 'WEEK',
  },
  {
    entryId: 5,
    title: '서울숲 영상 열람',
    occurredAt: '26.07.12 오후 4:20',
    amount: -3,
    flow: 'SPENT',
    period: 'MONTH',
  },
];

/** 기간별로 포함되는 범위. 좁은 기간은 넓은 기간에 포함된다. */
const periodsWithin: Record<CreditPeriod, CreditPeriod[]> = {
  TODAY: ['TODAY'],
  WEEK: ['TODAY', 'WEEK'],
  MONTH: ['TODAY', 'WEEK', 'MONTH'],
};

/**
 * 크레딧 내역 조회 목업.
 *
 * 실제 API도 기간을 쿼리로 받을 것으로 보여 시그니처를 맞춰 뒀다.
 * 종류 필터는 목록이 작아 화면에서 걸러도 되지만 서버와 같게 여기서 처리한다.
 */
export async function fetchMockCreditEntries(period: CreditPeriod): Promise<CreditEntry[]> {
  await delay(MOCK_LATENCY_MS);

  const included = periodsWithin[period];
  return creditEntries
    .filter((entry) => included.includes(entry.period))
    .map(({ period: _period, ...entry }) => entry);
}

/** 이번 세션에서 이미 쓴 닉네임. 중복 확인 실패를 재현한다. */
const takenNicknames = new Set(['와글이', '테스트']);

/** 닉네임 중복 확인 목업. 위 목록에 있으면 사용할 수 없다고 답한다. */
export async function checkMockNickname(nickname: string): Promise<boolean> {
  await delay(MOCK_LATENCY_MS);
  return !takenNicknames.has(nickname.trim());
}
