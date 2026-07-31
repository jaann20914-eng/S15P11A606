import { apiRequest } from '../client';
import { usesMock } from '../config';
import { fetchMockMyProfile } from '@/mocks/mypage';
import type { ActivityMonth, MyProfileResponse } from '@/types/user';

/**
 * 내 프로필 요약 조회 — `GET /api/v1/users/me`
 *
 * 뷰 신뢰도·보유 크레딧·오늘 영상핀 수와 선택한 월의 활동을 함께 준다.
 * 사용자는 액세스 토큰에서 정하므로 식별자를 보내지 않는다.
 *
 * `year`·`month`를 생략하면 서버가 현재 서비스 연월을 쓴다. 서비스 날짜 경계는
 * Asia/Seoul 오전 4시라 자정 직후에는 전날로 집계된다. 그 판단은 서버가 한다.
 *
 * 오류 코드: `INVALID_YEAR_MONTH` `UNAUTHORIZED` `USER_NOT_FOUND`
 * `USER_PROFILE_FETCH_FAILED`.
 */
function requestMyProfile(month?: ActivityMonth): Promise<MyProfileResponse> {
  return apiRequest<MyProfileResponse>({
    method: 'GET',
    url: '/api/v1/users/me',
    // 연월은 둘 다 보내거나 둘 다 생략해야 한다.
    params: month ? { year: month.year, month: month.month } : undefined,
  });
}

export async function getMyProfile(month?: ActivityMonth): Promise<MyProfileResponse> {
  if (usesMock('user/me')) return fetchMockMyProfile(month);
  return requestMyProfile(month);
}
