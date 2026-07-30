import type { CreditEntry, CreditPeriod, MyPin } from '@/types/mypage';
import type { ActivityDay, ActivityMonth, MyProfileResponse } from '@/types/user';
import { MOCK_LATENCY_MS, delay } from './pin';

/**
 * 마이페이지 고정 데이터.
 *
 * 백엔드에 마이페이지 API가 아직 없어 화면을 이 데이터로 돌린다.
 * 응답 모양은 명세를 그대로 따르므로 서버가 생기면 값만 바뀐다.
 */

/**
 * 목업이 현재 서비스 연월로 취급하는 달.
 *
 * 실제 서버는 Asia/Seoul 오전 4시를 경계로 현재 서비스 날짜를 정한다. 목업은 그 판단을
 * 흉내내지 않고 고정된 달을 쓴다. 이 값보다 미래는 조회할 수 없다.
 */
export const MOCK_SERVICE_MONTH = { year: 2026, month: 7 };

/**
 * 목업 데이터가 있는 첫 달. 이보다 앞선 달은 활동이 없어 모든 날짜가 0이다.
 *
 * 화면은 이 값을 모른다. 회색 칸과 0을 그대로 보여주므로 과거 이동에 제한이 없다.
 */
const MOCK_FIRST_MONTH = { year: 2026, month: 1 };

/** 그 달의 일수. 윤년도 자동으로 맞는다. */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * 날짜별 영상핀 수를 만든다.
 *
 * 달마다 다른 모양이 나오되 값은 항상 같도록 날짜와 달로 계산한다. 무작위를 쓰면
 * 다시 그릴 때마다 히트맵이 바뀌어 확인이 어렵다. 농도 네 단계가 모두 나오게 섞는다.
 */
function toDays(year: number, month: number): ActivityDay[] {
  const monthPart = String(month).padStart(2, '0');

  return Array.from({ length: daysInMonth(year, month) }, (_, index) => {
    const day = index + 1;
    const seed = (day * 7 + month * 11) % 13;
    const videoPinCount = seed < 7 ? 0 : seed < 10 ? 1 : seed < 12 ? 2 : 3;

    return { date: `${year}-${monthPart}-${String(day).padStart(2, '0')}`, videoPinCount };
  });
}

/**
 * 내 프로필 요약 목업.
 *
 * 요청한 연월의 활동을 만들어 준다. 데이터가 없는 과거 달은 모든 날짜를 0으로 채운다.
 * 서버가 붙으면 이 함수만 쓰이지 않게 되고 화면과 훅은 그대로 둔다.
 */
export async function fetchMockMyProfile(month?: ActivityMonth): Promise<MyProfileResponse> {
  await delay(MOCK_LATENCY_MS);

  const year = month?.year ?? MOCK_SERVICE_MONTH.year;
  const monthValue = month?.month ?? MOCK_SERVICE_MONTH.month;

  // 데이터가 없는 과거 달은 활동을 0으로 채운다.
  const empty =
    year < MOCK_FIRST_MONTH.year || (year === MOCK_FIRST_MONTH.year && monthValue < MOCK_FIRST_MONTH.month);

  const days = empty
    ? toDays(year, monthValue).map((day) => ({ ...day, videoPinCount: 0 }))
    : toDays(year, monthValue);

  return {
    userId: 1,
    nickname: '와글러',
    viewReliability: 92.5,
    creditBalance: 120,
    todayVideoPinCount: 2,
    serviceAccess: 'ALLOWED',
    monthlyActivity: {
      year,
      month: monthValue,
      days,
      summary: {
        // 명세대로 days 합계와 같아야 한다.
        createdVideoPinCount: days.reduce((sum, day) => sum + day.videoPinCount, 0),
        // 활동이 없는 달은 집계값도 0이다.
        earnedCredit: empty ? 0 : 220,
        helpfulViewCount: empty ? 0 : 97,
      },
    },
  };
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
