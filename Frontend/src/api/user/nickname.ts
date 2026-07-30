import { apiRequest } from '../client';
import { usesMockApi } from '../config';
import { checkMockNickname, updateMockNickname } from '@/mocks/mypage';
import type { NicknameAvailabilityResponse, NicknameUpdateResponse } from '@/types/user';

/**
 * 닉네임 중복 확인 — `GET /api/v1/users/nickname-availability`
 *
 * 닉네임 수정 전에 부른다. 이 응답은 그 닉네임을 예약하지 않는다. 확인과 저장 사이에 다른
 * 사용자가 먼저 쓸 수 있어 저장할 때 서버가 다시 검사한다.
 *
 * 인증은 액세스 토큰으로 한다. 인터셉터가 붙이므로 여기서 헤더를 다루지 않는다. 온보딩은
 * 온보딩 토큰을 쓸 예정이고 명세가 따로 나오므로, 그때 온보딩용 호출을 따로 만든다.
 *
 * 오류 코드: `INVALID_NICKNAME` `UNAUTHORIZED` `NICKNAME_AVAILABILITY_CHECK_FAILED`.
 * 형식을 어기면 중복 조회를 하지 않고 400으로 답하므로 보내기 전에 형식을 걸러 둔다.
 */
function requestNicknameAvailability(nickname: string): Promise<NicknameAvailabilityResponse> {
  return apiRequest<NicknameAvailabilityResponse>({
    method: 'GET',
    url: '/api/v1/users/nickname-availability',
    params: { nickname },
  });
}

export async function getNicknameAvailability(
  nickname: string,
): Promise<NicknameAvailabilityResponse> {
  if (usesMockApi) return checkMockNickname(nickname);
  return requestNicknameAvailability(nickname);
}

/**
 * 내 닉네임 수정 — `PATCH /api/v1/users/me`
 *
 * 사용자는 액세스 토큰에서 정하므로 식별자를 보내지 않는다.
 *
 * 미리 중복을 확인했더라도 서버가 형식과 중복을 다시 검사한다. 확인과 저장 사이에 다른
 * 사용자가 먼저 쓸 수 있어 `NICKNAME_ALREADY_EXISTS`가 올 수 있고, 그때 닉네임은 바뀌지
 * 않는다.
 *
 * 오류 코드: `INVALID_NICKNAME` `UNAUTHORIZED` `NICKNAME_ALREADY_EXISTS`
 * `NICKNAME_UPDATE_FAILED`.
 */
function requestNicknameUpdate(nickname: string): Promise<NicknameUpdateResponse> {
  return apiRequest<NicknameUpdateResponse>({
    method: 'PATCH',
    url: '/api/v1/users/me',
    data: { nickname },
  });
}

export async function updateMyNickname(nickname: string): Promise<NicknameUpdateResponse> {
  if (usesMockApi) return updateMockNickname(nickname);
  return requestNicknameUpdate(nickname);
}
