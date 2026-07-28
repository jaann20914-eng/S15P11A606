import { apiRequest } from '../client';
import { usesMockApi } from '../config';
import { leaveMockPinChats } from '@/mocks/chat';

/**
 * "이미 떠났어요" — 핀에 연결된 모든 채팅방을 LEFT로 바꾼다.
 *
 * 핀 상세 화면에서 부르지만 채팅 도메인 API다(경로도 `/api/v1/chat/...`).
 * 핀 자체와 크레딧 거래는 그대로 두므로 핀 삭제와 다르다.
 *
 * 오류 코드: `INVALID_PIN_ID` `UNAUTHORIZED` `CHAT_PIN_LEAVE_FORBIDDEN`
 * `PIN_NOT_FOUND` `CHAT_PIN_LEAVE_FAILED`.
 */
async function requestLeavePinChats(pinId: number): Promise<number[]> {
  const data = await apiRequest<{ leftChatRoomIds: number[] }>({
    method: 'POST',
    url: `/api/v1/chat/pins/${pinId}/rooms/leave`,
  });
  return data.leftChatRoomIds;
}

/** 종료된 채팅방 id 목록을 돌려준다. 바꿀 방이 없으면 빈 배열이다. */
export function leavePinChats(pinId: number): Promise<number[]> {
  return usesMockApi ? leaveMockPinChats(pinId) : requestLeavePinChats(pinId);
}
