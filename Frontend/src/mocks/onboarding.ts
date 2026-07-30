import { MOCK_LATENCY_MS } from './pin';
import { ApiError } from '@/api/client';
import type { OnboardingResult, OnboardingSubmission } from '@/types/onboarding';

/**
 * 온보딩 완료 고정 응답.
 *
 * 서버 없이 로그인 → 온보딩 → 홈 흐름을 끝까지 확인하기 위한 값이다.
 * 발급되는 토큰은 가짜이므로 목업 모드에서만 의미가 있다.
 *
 * 화면에서 실패 처리를 확인하는 법: 닉네임을 `중복`으로 입력하면 `NICKNAME_ALREADY_EXISTS`가 난다.
 */
const DUPLICATE_NICKNAME = '중복';

export function mockSubmitOnboarding(submission: OnboardingSubmission): Promise<OnboardingResult> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (submission.nickname === DUPLICATE_NICKNAME) {
        reject(new ApiError(409, 'NICKNAME_ALREADY_EXISTS', '이미 사용 중인 닉네임입니다.'));
        return;
      }

      resolve({
        memberId: 1,
        viewAngle: 90,
        creditBalance: 10,
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
      });
    }, MOCK_LATENCY_MS);
  });
}
