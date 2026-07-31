import { ApiError } from '@/api/client';
import type { TodayPin, TodayPinStatus, TodayPinsQuery, TodayPinsResponse } from '@/types/pin';
import type {
  CreditTransaction,
  CreditTransactionsQuery,
  CreditTransactionsResponse,
} from '@/types/credit';
import type {
  ActivityDay,
  ActivityMonth,
  MyProfileResponse,
  NicknameAvailabilityResponse,
  NicknameUpdateResponse,
} from '@/types/user';
import { isValidNickname, normalizeNickname } from '@/utils/nickname';
import { MOCK_LATENCY_MS, delay, mockPinId, registerMockPinScenario } from './pin';

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
    // 수정 목업이 바꾼 값을 그대로 돌려준다. 저장이 반영되는 것을 확인할 수 있다.
    nickname: currentNickname,
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

/** 오늘 등록한 영상핀에 쓰는 장소. 목록에 같은 이름만 늘어놓으면 순서를 확인할 수 없다. */
const todayPinPlaces = [
  {
    placeId: 11,
    placeName: '바나프레소 역삼점',
    placeAddress: '서울 광진구 동일로 60길 47 1층 (군자동)',
  },
  { placeId: 12, placeName: '성수 연무장길', placeAddress: '서울 성동구 연무장길 45' },
  { placeId: 13, placeName: '서울숲', placeAddress: '서울 성동구 뚝섬로 273' },
  { placeId: 14, placeName: '더현대 서울', placeAddress: '서울 영등포구 여의대로 108' },
  { placeId: 15, placeName: '망원한강공원', placeAddress: '서울 마포구 마포나루길 467' },
];

/**
 * 상태를 돌려 쓰는 순서.
 *
 * 최근 등록한 것이 아직 처리 중이고 오래된 것이 공개된 상태가 자연스럽다.
 * 명세의 `RESHOOT`은 화면에서 다루지 않기로 해 넣지 않는다.
 */
const todayPinStatuses: TodayPinStatus[] = ['PROCESSING', 'ACTIVE', 'ACTIVE', 'ACTIVE'];

/** 오늘 등록한 영상핀 수. 한 페이지(20건)를 넘겨 커서 이어받기를 확인할 수 있게 둔다. */
const TODAY_PIN_COUNT = 26;

/**
 * 오늘 등록한 핀이 쓸 식별자 대역.
 *
 * 상세 목업의 시나리오 표가 1~6번을 미구매·열람완료·평가완료·내 핀으로 쓰고 있다. 여기서 그
 * 번호를 겹쳐 쓰면 아래 등록이 표를 덮어써서, 어느 핀을 열어도 내 핀 화면만 나온다.
 */
const TODAY_PIN_ID_OFFSET = 200;

/** 목업 기본 페이지 크기. 명세의 서버 기본값과 같다. */
const MOCK_TODAY_PIN_PAGE_SIZE = 20;

/**
 * 오늘 등록한 영상핀 목업.
 *
 * 등록 시각을 지금부터 거슬러 만든다. 고정 문자열로 두면 "오늘"이 아니게 되어 화면 문구와
 * 어긋난다. 서버가 최신순으로 주므로 여기서도 최근 것이 앞에 온다.
 */
const todayPins: TodayPin[] = Array.from({ length: TODAY_PIN_COUNT }, (_, index) => {
  const createdAt = new Date();
  // 12분 간격으로 거슬러 올라간다. 26건이면 5시간 남짓이라 모두 오늘 안에 들어온다.
  createdAt.setMinutes(createdAt.getMinutes() - index * 12);

  return {
    pinId: mockPinId(TODAY_PIN_ID_OFFSET + TODAY_PIN_COUNT - index),
    ...todayPinPlaces[index % todayPinPlaces.length],
    status: todayPinStatuses[index % todayPinStatuses.length],
    createdAt: createdAt.toISOString(),
  };
});

/**
 * 목록에서 누르면 상세가 열리도록 시나리오를 등록한다.
 *
 * 오늘 등록한 핀은 내가 쓴 핀이라 상세도 작성자 화면이어야 한다. 등록하지 않으면 상세 목업의
 * 표에 없어서 조회 실패 화면이 뜬다.
 */
todayPins.forEach((pin) => registerMockPinScenario(pin.pinId, 'owner'));

export async function fetchMockTodayPins(query: TodayPinsQuery): Promise<TodayPinsResponse> {
  await delay(MOCK_LATENCY_MS);

  // 커서는 "이 핀 다음부터"를 뜻한다. 값이 목록에 없으면 처음부터 준다.
  const start = query.cursor
    ? todayPins.findIndex((pin) => String(pin.pinId) === query.cursor) + 1
    : 0;
  const size = query.limit ?? MOCK_TODAY_PIN_PAGE_SIZE;
  const items = todayPins.slice(start, start + size);
  const last = items[items.length - 1];

  return {
    items,
    nextCursor: last && start + size < todayPins.length ? String(last.pinId) : null,
  };
}

/**
 * 거래 종류별 금액과 문구. 목업 원장을 만들 때 순서대로 돌려 쓴다.
 *
 * 백엔드 `CreditTransactionType`의 일곱 가지를 모두 한 번씩 넣었다. 합이 양수여야 잔액이
 * 음수로 내려가지 않는다 — 지금 한 바퀴가 `+4`다.
 */
const creditKinds: Array<Pick<CreditTransaction, 'type' | 'amount' | 'description'>> = [
  { type: 'PIN_EVALUATION_PARTICIPATED', amount: 1, description: '영상핀 평가 참여' },
  { type: 'VIDEO_VIEWED', amount: -3, description: '성수 연무장길 영상 열람' },
  { type: 'RECEIVED_CHAT_REQUEST_ACCEPTED', amount: 5, description: '채팅 요청 수락' },
  { type: 'RECEIVED_HELPFUL_PIN_EVALUATION', amount: 2, description: '내 영상핀이 유익하다는 평가를 받음' },
  { type: 'PIN_EVALUATION_PARTICIPATED', amount: 1, description: '영상핀 평가 참여' },
  { type: 'VIDEO_VIEWED', amount: -3, description: '서울숲 영상 열람' },
  { type: 'RECEIVED_HELPFUL_PIN_EVALUATION', amount: 2, description: '내 영상핀이 유익하다는 평가를 받음' },
  { type: 'RECEIVED_DISAPPOINTING_PIN_EVALUATION', amount: -1, description: '내 영상핀이 아쉽다는 평가를 받음' },
  { type: 'SENT_CHAT_REQUEST_ACCEPTED', amount: -5, description: '채팅 요청이 수락됨' },
  { type: 'RECEIVED_CHAT_REQUEST_ACCEPTED', amount: 5, description: '채팅 요청 수락' },
];

/**
 * 기간별로 만들어 둘 거래 수.
 *
 * 어느 필터를 골라도 한 페이지(20건)를 넘겨야 커서로 이어 받는 것을 확인할 수 있다.
 * `오늘`만 봐도 두 페이지가 나오도록 잡았다.
 */
const creditVolume = [
  { count: 28, from: 0, to: 0 }, // 오늘
  { count: 30, from: 1, to: 6 }, // 1주일
  { count: 40, from: 7, to: 29 }, // 1달
  { count: 20, from: 30, to: 90 }, // 그 밖 — 전체 기간에만 걸린다
];

/**
 * 크레딧 거래 원장.
 *
 * `daysAgo`로 시각을 만든다. 날짜를 문자열로 박아 두면 시간이 지나면서 "오늘" 건이 사라져
 * 기간 필터를 확인할 수 없게 된다.
 *
 * 무작위를 쓰지 않는다. 다시 그릴 때마다 목록이 바뀌면 스크롤로 이어 받은 것이 새 데이터인지
 * 같은 데이터인지 구분할 수 없다.
 *
 * 서버는 거래 시각 내림차순으로 주므로 여기서도 최근 것이 앞에 온다.
 */
const creditLedger: Array<
  Omit<CreditTransaction, 'createdAt' | 'balanceAfter'> & {
    daysAgo: number;
    hour: number;
    minute: number;
  }
> = buildCreditLedger();

function buildCreditLedger() {
  const generated = creditVolume.reduce((sum, group) => sum + group.count, 0);
  const ledger = [];

  // 1번은 가장 오래된 가입 축하 크레딧이 쓴다. 생성분은 2번부터 위로 올라간다.
  let id = generated + 2;
  /** 거래 종류를 고르는 순번. 그룹이 바뀌어도 이어져야 종류가 골고루 섞인다. */
  let sequence = 0;

  for (const group of creditVolume) {
    const span = group.to - group.from + 1;

    for (let index = 0; index < group.count; index += 1) {
      // 그룹 안에서 날짜를 고르게 퍼뜨린다.
      const daysAgo = group.from + Math.floor((index * span) / group.count);
      // 같은 날 안에서는 뒤로 갈수록 이른 시각이어야 목록 순서와 맞는다.
      const minutesBefore = index * 17;

      ledger.push({
        ...creditKinds[sequence % creditKinds.length],
        transactionId: (id -= 1),
        daysAgo,
        hour: 23 - Math.floor(minutesBefore / 60),
        minute: 59 - (minutesBefore % 60),
      });

      sequence += 1;
    }
  }

  ledger.push({
    transactionId: 1,
    type: 'WELCOME_BONUS' as const,
    amount: 20,
    description: '가입 축하 크레딧',
    daysAgo: 120,
    hour: 10,
    minute: 0,
  });

  return ledger;
}

/** 기간 필터가 포함하는 최대 경과 일수. 생략하면 전체 기간이다. */
const daysWithinPeriod: Record<NonNullable<CreditTransactionsQuery['period']>, number> = {
  today: 0,
  week: 7,
  month: 30,
};

/** 한 페이지에 담는 개수. 커서 이어받기를 확인할 수 있도록 작게 둔다. */
const MOCK_CREDIT_PAGE_SIZE = 4;

/** `daysAgo`·시·분을 실제 시각으로 만든다. */
function toCreatedAt(daysAgo: number, hour: number, minute: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

/**
 * 크레딧 내역 조회 목업.
 *
 * 서버처럼 종류·기간을 걸러 내고 커서로 잘라 준다. 잔액은 원장을 합해 만들고 각 거래의
 * `balanceAfter`도 그 원장에서 계산한다 — 명세가 "잔액과 내역은 같은 원장을 기준으로 한다"고
 * 정하고 있어 두 값이 어긋나면 확인이 무의미해진다.
 */
export async function fetchMockCreditTransactions(
  query: CreditTransactionsQuery,
): Promise<CreditTransactionsResponse> {
  await delay(MOCK_LATENCY_MS);

  // 오래된 것부터 더해야 각 시점의 잔액이 나온다. 원장은 최신순이라 뒤에서부터 본다.
  let running = 0;
  const withBalance: CreditTransaction[] = [...creditLedger]
    .reverse()
    .map(({ daysAgo, hour, minute, ...entry }) => {
      running += entry.amount;
      return { ...entry, balanceAfter: running, createdAt: toCreatedAt(daysAgo, hour, minute) };
    })
    .reverse();

  const balance = running;

  const maxDays = query.period ? daysWithinPeriod[query.period] : Number.POSITIVE_INFINITY;
  const oldest = Date.now() - (maxDays + 1) * 24 * 60 * 60 * 1000;

  const matched = withBalance.filter((entry) => {
    if (query.type === 'spent' && entry.amount >= 0) return false;
    if (query.type === 'earned' && entry.amount <= 0) return false;
    // `today`는 경과 일수가 아니라 날짜가 같은지로 봐야 한다.
    if (query.period === 'today') {
      const created = new Date(entry.createdAt);
      const now = new Date();
      return (
        created.getFullYear() === now.getFullYear() &&
        created.getMonth() === now.getMonth() &&
        created.getDate() === now.getDate()
      );
    }
    return Date.parse(entry.createdAt) >= oldest;
  });

  // 커서는 "이 거래 다음부터"를 뜻한다. 값이 목록에 없으면 처음부터 준다.
  const start = query.cursor
    ? matched.findIndex((entry) => String(entry.transactionId) === query.cursor) + 1
    : 0;
  const size = query.limit ?? MOCK_CREDIT_PAGE_SIZE;
  const items = matched.slice(start, start + size);
  const last = items[items.length - 1];

  return {
    balance,
    items,
    nextCursor: last && start + size < matched.length ? String(last.transactionId) : null,
  };
}

/**
 * 이미 다른 사용자가 쓰는 닉네임. 중복을 재현한다.
 *
 * 서버가 정규화한 값으로 비교하므로 목업도 정규화된 형태로 적어 둔다.
 */
const takenNicknames = new Set(['와글이', '테스트', 'waggle']);

/**
 * 지금 내 닉네임. 수정 목업이 이 값을 바꾸고 프로필 조회가 이 값을 돌려준다.
 *
 * 자기 이름도 이미 쓰이는 이름이라 중복으로 잡힌다. 서버도 사용자를 가리지 않고 검사한다.
 */
let currentNickname = '와글러';
takenNicknames.add(currentNickname);

/**
 * 닉네임 중복 확인 목업.
 *
 * 서버와 같이 형식을 먼저 보고, 어긋나면 `available: false`로 답한다. 형식 위반은 원래
 * 400이지만 화면이 보내기 전에 걸러 이 경로로는 오지 않는다.
 */
export async function checkMockNickname(nickname: string): Promise<NicknameAvailabilityResponse> {
  await delay(MOCK_LATENCY_MS);

  const normalized = normalizeNickname(nickname);
  return {
    nickname: normalized,
    available: isValidNickname(normalized) && !takenNicknames.has(normalized),
  };
}

/**
 * 닉네임 수정 목업.
 *
 * 서버처럼 형식과 중복을 다시 검사한다. 미리 확인했더라도 실패할 수 있는 경로라 실제와 같은
 * `ApiError`를 던져 화면 분기를 그대로 확인할 수 있게 한다.
 *
 * 성공하면 프로필 조회가 바뀐 이름을 돌려준다. 저장된 것처럼 보이지 않으면 확인이 어렵다.
 */
export async function updateMockNickname(nickname: string): Promise<NicknameUpdateResponse> {
  await delay(MOCK_LATENCY_MS);

  const normalized = normalizeNickname(nickname);

  if (!isValidNickname(normalized)) {
    throw new ApiError(400, 'INVALID_NICKNAME', '닉네임 형식이 올바르지 않습니다.');
  }
  if (takenNicknames.has(normalized)) {
    throw new ApiError(409, 'NICKNAME_ALREADY_EXISTS', '이미 사용 중인 닉네임입니다.');
  }

  // 쓰던 이름은 다시 비워 준다. 바꿨다 되돌리는 확인이 막히지 않게 한다.
  takenNicknames.delete(currentNickname);
  currentNickname = normalized;
  takenNicknames.add(currentNickname);

  return { nickname: currentNickname };
}
