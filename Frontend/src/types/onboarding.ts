import type { PreferenceCategoryCode } from '@/constants/categories';
import type { TokenPair } from './auth';

/** 연령대. 서버가 enum으로 파싱하므로 표시 문구가 아니라 이 값을 보낸다. */
export type AgeGroup =
  'TEENS' | 'TWENTIES' | 'THIRTIES' | 'FORTIES' | 'FIFTIES' | 'SIXTIES' | 'SEVENTIES_AND_OVER';

export type Gender = 'MALE' | 'FEMALE';

/**
 * 온보딩 완료 요청 — `POST /api/v1/onboarding`
 *
 * `preferredCategories`는 중복 없이 1~3개다. 닉네임 유효성과 중복은 서버가 최종 검증한다.
 */
export interface OnboardingSubmission {
  ageGroup: AgeGroup;
  gender: Gender;
  nickname: string;
  preferredCategories: PreferenceCategoryCode[];
}

/**
 * 온보딩 완료 응답.
 *
 * 서비스 토큰이 여기서 처음 발급된다. 온보딩 토큰은 이 응답을 저장한 뒤에 버린다.
 */
export interface OnboardingResult extends TokenPair {
  memberId: number;
  /** 초기 뷰 각도. 서비스 기본값 90이다. */
  viewAngle: number;
  /** 온보딩 보상으로 지급된 초기 크레딧 잔액. */
  creditBalance: number;
}
