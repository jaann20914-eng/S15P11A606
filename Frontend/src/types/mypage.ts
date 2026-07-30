/**
 * 마이페이지 도메인 타입.
 *
 * 아직 API가 없어 서버 응답 규격이 확정되지 않았다. 화면이 실제로 쓰는 값만 정의했고
 * 명세가 나오면 필드 이름을 맞춘다.
 */

/** 내가 쓴 영상핀의 공개 상태. AI 블러 처리가 끝나야 상세를 볼 수 있다. */
export type MyPinState = 'PENDING' | 'PUBLISHED';

/** 마이페이지에서 보여주는 내 영상핀 한 건. */
export interface MyPin {
  pinId: number;
  /** 등록 시각. `14:05` 형태로 표시한다. */
  createdAt: string;
  placeName: string;
  placeAddress: string;
  state: MyPinState;
}

/** 크레딧이 늘었는지 줄었는지. */
export type CreditFlow = 'EARNED' | 'SPENT';

/** 크레딧 내역 한 줄. */
export interface CreditEntry {
  entryId: number;
  /** 사유. `영상핀 평가 참여` 같은 문구가 그대로 온다. */
  title: string;
  /** 발생 시각. `오늘 오후 2:14` 형태로 표시한다. */
  occurredAt: string;
  /** 변동량. 적립은 양수, 사용은 음수다. */
  amount: number;
  flow: CreditFlow;
}

/** 내역 목록의 종류 필터. */
export type CreditFilter = 'ALL' | 'SPENT' | 'EARNED';

/** 내역 목록의 기간 필터. */
export type CreditPeriod = 'TODAY' | 'WEEK' | 'MONTH';

/** 마이페이지 요약. 뷰 신뢰도와 오늘 활동을 담는다. */
export interface MyProfileSummary {
  /** 뷰 신뢰도. 0~360 사이이며 도(°)로 표시한다. */
  trustAngle: number;
  creditBalance: number;
  /** 오늘 등록한 영상핀 수. */
  todayPinCount: number;
}

/** 달력 히트맵 한 칸. `null`은 그 달에 속하지 않는 빈칸이다. */
export type ActivityLevel = 0 | 1 | 2 | 3;

/** 이번 달 활동 요약과 날짜별 활동량. */
export interface MonthlyActivity {
  /** 1~12. */
  month: number;
  /**
   * 달력 칸 배열. 월요일 시작이며 앞뒤로 다른 달에 속한 칸은 `null`이다.
   * 값은 그날 등록한 영상핀 수를 0~3 구간으로 묶은 것이다.
   */
  cells: Array<ActivityLevel | null>;
  pinCount: number;
  earnedCredit: number;
  /** 다른 사용자가 내 핀을 열람한 횟수. */
  viewCount: number;
}

/** 닉네임 최소·최대 길이. */
export const MIN_NICKNAME_LENGTH = 2;
export const MAX_NICKNAME_LENGTH = 12;

/** 종류 필터에 노출하는 한글 라벨. */
export const creditFilterLabel: Record<CreditFilter, string> = {
  ALL: '전체',
  SPENT: '사용',
  EARNED: '적립',
};

/** 기간 필터에 노출하는 한글 라벨. */
export const creditPeriodLabel: Record<CreditPeriod, string> = {
  TODAY: '오늘',
  WEEK: '1주일',
  MONTH: '1달',
};

/** 적립·사용 라벨. 내역 줄의 설명에 쓴다. */
export const creditFlowLabel: Record<CreditFlow, string> = {
  EARNED: '적립',
  SPENT: '사용',
};
