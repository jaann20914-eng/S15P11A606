import { apiRequest } from '../client';
import { usesMock } from '../config';
import { fetchMockMyCategories, updateMockProfile } from '@/mocks/mypage';
import type { PreferenceCategoryCode } from '@/constants/categories';
import type { CategoryPreferenceResponse, ProfileUpdateResponse } from '@/types/user';
import { traceUser } from './log';

/**
 * 내 관심 카테고리 조회 — `GET /api/v1/users/me/categories`
 *
 * 마이페이지 수정 화면이 지금 고른 것을 미리 켜 두는 데 쓴다. 프로필 응답
 * (`GET /users/me`)에는 없어서 따로 받는다. 사용자는 액세스 토큰이 정한다.
 *
 * 오류 코드: `UNAUTHORIZED` `USER_NOT_FOUND` `CATEGORY_PREFERENCE_FETCH_FAILED`.
 */
function requestMyCategories(): Promise<CategoryPreferenceResponse> {
  return apiRequest<CategoryPreferenceResponse>({
    method: 'GET',
    url: '/api/v1/users/me/categories',
  });
}

export function getMyCategories(): Promise<CategoryPreferenceResponse> {
  return traceUser(
    '관심 카테고리',
    'user/categories',
    () => (usesMock('user/categories') ? fetchMockMyCategories() : requestMyCategories()),
    (result) => ({ 선택: result.preferredCategories.join(', ') || '없음' }),
  );
}

/**
 * 닉네임과 관심 카테고리 한 번에 수정 — `PATCH /api/v1/users/me`
 *
 * **둘을 함께 보낸다.** 서버가 한 트랜잭션으로 처리해 하나라도 어긋나면 전부 되돌린다 —
 * 닉네임만 바뀌고 카테고리는 그대로인 어중간한 상태가 생기지 않는다. 그래서 화면도 저장
 * 버튼 하나로 묶는다.
 *
 * 바꾸지 않은 값도 지금 값을 그대로 실어 보낸다. 부분 수정이 아니라 **최종 상태**를 보내는
 * 계약이라, 빠뜨리면 서버가 비운 것으로 읽는다(카테고리 0개는 거절된다).
 *
 * 미리 중복을 확인했더라도 서버가 형식과 중복을 다시 본다. 확인과 저장 사이에 다른 사용자가
 * 먼저 쓸 수 있어서다.
 *
 * 오류 코드: `INVALID_REQUEST` `INVALID_NICKNAME` `NICKNAME_ALREADY_EXISTS`
 * `INVALID_CATEGORY_PREFERENCE` `UNAUTHORIZED` `USER_NOT_FOUND`
 * `NICKNAME_UPDATE_FAILED` `CATEGORY_PREFERENCE_UPDATE_FAILED`.
 */
function requestProfileUpdate(
  nickname: string,
  preferredCategories: PreferenceCategoryCode[],
): Promise<ProfileUpdateResponse> {
  return apiRequest<ProfileUpdateResponse>({
    method: 'PATCH',
    url: '/api/v1/users/me',
    data: { nickname, preferredCategories },
  });
}

export function updateMyProfile(
  nickname: string,
  preferredCategories: PreferenceCategoryCode[],
): Promise<ProfileUpdateResponse> {
  return traceUser(
    '프로필 수정',
    'user/profile-update',
    () =>
      usesMock('user/profile-update')
        ? updateMockProfile(nickname, preferredCategories)
        : requestProfileUpdate(nickname, preferredCategories),
    (result) => ({ 닉네임: result.nickname, 카테고리: result.preferredCategories.join(', ') }),
  );
}
