import type { PinId, TodayPinStatus } from './pin';

/**
 * 마이페이지에서 화면이 쓰는 모양.
 *
 * 서버 계약은 도메인별로 `types/pin.ts`·`types/credit.ts`·`types/user.ts`에 있고, 훅이
 * 이 모양으로 바꿔 준다. 화면이 ISO 시각이나 서버 enum을 직접 다루지 않게 하려는 것이다.
 */

/** 마이페이지에서 보여주는 내 핀 한 건. */
export interface MyPin {
  pinId: PinId;
  /** 등록 시각. 모두 오늘 건이라 `14:05`처럼 시각만 보여준다. */
  time: string;
  placeName: string;
  placeAddress: string;
  status: TodayPinStatus;
  /**
   * 공개가 끝났는지(게시 후 1시간 경과).
   *
   * 상태(`status`)는 서버 처리 결과라 만료돼도 `ACTIVE`로 남는다. 목록은 이 값이 참이면
   * "만료된 글"로 보여준다. 상세는 열 수 있고(작성자는 만료 후에도 조회 가능) 수정만 잠긴다.
   */
  expired: boolean;
}

/** 크레딧이 늘었는지 줄었는지. */
export type CreditFlow = 'EARNED' | 'SPENT';

/** 크레딧 내역 한 줄. */
export interface CreditEntry {
  entryId: number;
  /** 사유. `핀 평가 참여` 같은 문구가 그대로 온다. */
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
