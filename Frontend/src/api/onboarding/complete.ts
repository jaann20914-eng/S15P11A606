import { apiRequest } from '../client';
import { usesMockApi } from '../config';
import { mockSubmitOnboarding } from '@/mocks/onboarding';
import type { OnboardingResult, OnboardingSubmission } from '@/types/onboarding';

/**
 * 온보딩 완료 — `POST /api/v1/onboarding`
 *
 * **온보딩 토큰(`purpose: "ONBOARDING"`) 전용 엔드포인트다.** 일반 accessToken으로는 호출할 수 없고,
 * 반대로 이 토큰을 서비스 API에 쓸 수도 없다. 헤더 선택은 `client.ts`가 경로로 판단하므로
 * 호출부는 토큰을 신경 쓰지 않는다.
 *
 * 성공하면 서비스 Access/Refresh Token이 처음 발급된다. 저장과 온보딩 토큰 폐기는
 * `useAuthStore.completeOnboarding`이 순서대로 처리한다.
 *
 * 오류 코드: `INVALID_ONBOARDING_REQUEST` `INVALID_ONBOARDING_TOKEN`
 * `ONBOARDING_TOKEN_ALREADY_USED` `NICKNAME_ALREADY_EXISTS` `ONBOARDING_ALREADY_COMPLETED`
 * `ONBOARDING_FAILED`.
 */
function requestOnboarding(submission: OnboardingSubmission): Promise<OnboardingResult> {
  return apiRequest<OnboardingResult>({
    method: 'POST',
    url: '/api/v1/onboarding',
    data: submission,
  });
}

export function submitOnboarding(submission: OnboardingSubmission): Promise<OnboardingResult> {
  return usesMockApi ? mockSubmitOnboarding(submission) : requestOnboarding(submission);
}
