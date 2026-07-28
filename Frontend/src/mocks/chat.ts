import { ApiError } from '@/api/client';
import { MOCK_LATENCY_MS, delay, resolvePinDetailScenario } from './pin';

/**
 * 채팅 도메인 고정 데이터.
 *
 * 지금은 핀 상세의 "이미 떠났어요"만 있다. 채팅방 목록·메시지 API를 붙이면 여기에 추가한다.
 * 소유자 판정은 핀 시나리오를 그대로 쓰므로 `./pin`을 참조한다.
 */

/** "이미 떠났어요" 목업. 실제 API는 핀에 연결된 채팅방 id 목록을 돌려준다. */
export async function leaveMockPinChats(pinId: number): Promise<number[]> {
  await delay(MOCK_LATENCY_MS);

  if (resolvePinDetailScenario(pinId) !== 'owner') {
    throw new ApiError(403, 'CHAT_PIN_LEAVE_FORBIDDEN', '해당 핀의 채팅방에서 나갈 권한이 없어요.');
  }

  return [7];
}
