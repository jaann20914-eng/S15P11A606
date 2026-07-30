/**
 * 사용자 도메인 서버 계약.
 *
 * `GET /api/v1/users/me` 응답을 그대로 옮겼다. 화면이 쓰는 모양(달력 칸 배열 등)은
 * `types/mypage.ts`에 따로 두고 훅에서 변환한다.
 */

/** 서비스 이용 가능 상태. 뷰 신뢰도가 0도면 `BLOCKED`가 된다. */
export type ServiceAccess = 'ALLOWED' | 'BLOCKED';

/** 날짜별 활동. 활동이 없는 날도 `0`으로 채워서 온다. */
export interface ActivityDay {
  /** `YYYY-MM-DD`. 서비스 날짜 기준이다. */
  date: string;
  videoPinCount: number;
}

/** 선택한 월의 활동 요약. 결과가 없어도 각 필드가 `0`으로 온다. */
export interface MonthlyActivitySummary {
  createdVideoPinCount: number;
  earnedCredit: number;
  /** 내 영상핀이 다른 사용자에게 정상 열람된 횟수. */
  helpfulViewCount: number;
}

/** 선택한 월의 활동. `days`는 그 달의 모든 날짜를 오름차순으로 담는다. */
export interface MonthlyActivityResponse {
  year: number;
  month: number;
  days: ActivityDay[];
  summary: MonthlyActivitySummary;
}

/**
 * `GET /api/v1/users/me` 응답의 `data`.
 *
 * `creditBalance`는 지금 잔액이고 `summary.earnedCredit`은 그 달에 번 크레딧이라 값이 다르다.
 */
export interface MyProfileResponse {
  userId: number;
  nickname: string;
  /** 뷰 신뢰도. 각도이며 소수점이 있을 수 있다. */
  viewReliability: number;
  creditBalance: number;
  todayVideoPinCount: number;
  serviceAccess: ServiceAccess;
  monthlyActivity: MonthlyActivityResponse;
}

/** 조회할 연월. 둘 다 생략하면 서버가 현재 서비스 연월을 쓴다. */
export interface ActivityMonth {
  year: number;
  month: number;
}
