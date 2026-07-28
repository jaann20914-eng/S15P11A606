import { ApiError } from '@/api/client';
import type { ChatRequestResult, PinChatLeaveResult } from '@/types/chat';
import { MOCK_LATENCY_MS, delay, resolvePinDetailScenario } from './pin';

/**
 * 채팅 도메인 고정 데이터.
 *
 * 지금은 핀 상세의 "이미 떠났어요"만 있다. 채팅방 목록·메시지 API를 붙이면 여기에 추가한다.
 * 소유자 판정은 핀 시나리오를 그대로 쓰므로 `./pin`을 참조한다.
 */

/** 이번 세션에서 채팅을 요청한 핀 → 만들어진 방 id. 중복 요청 409를 재현한다. */
const chatRoomIdByPinId = new Map<number, number>();

let nextMockRoomId = 7;

/**
 * 익명 채팅 요청 목업.
 * 미구매·본인 핀(403)과 이미 대기 중인 요청(409)을 실제 서버와 같은 코드로 재현한다.
 */
export async function createMockChatRequest(pinId: number): Promise<ChatRequestResult> {
  await delay(MOCK_LATENCY_MS);

  const scenario = resolvePinDetailScenario(pinId);

  if (scenario === 'notFound') {
    throw new ApiError(404, 'PIN_NOT_FOUND', '조회할 수 있는 핀이 없습니다.');
  }

  // 작성자 본인과 미구매자는 요청할 수 없다.
  if (scenario === 'owner' || scenario === 'preview') {
    throw new ApiError(403, 'CHAT_REQUEST_FORBIDDEN', '채팅을 요청할 수 없습니다.');
  }

  // 'evaluated' 시나리오는 이미 PENDING 방을 갖고 있다.
  if (scenario === 'evaluated' || chatRoomIdByPinId.has(pinId)) {
    throw new ApiError(409, 'CHAT_REQUEST_ALREADY_EXISTS', '이미 대기 중인 요청 또는 채팅방이 있습니다.');
  }

  const roomId = nextMockRoomId++;
  chatRoomIdByPinId.set(pinId, roomId);

  return { roomId, pinId, status: 'PENDING', createdAt: new Date().toISOString() };
}

/** 이번 세션에서 이미 나간 핀. 두 번째 요청은 빈 배열을 준다. */
const leftPinIds = new Set<number>();

/**
 * "이미 떠났어요" 목업.
 * 권한 없음과 "이미 전부 LEFT" 두 경우를 실제 서버와 같게 재현한다.
 */
export async function leaveMockPinChats(pinId: number): Promise<PinChatLeaveResult> {
  await delay(MOCK_LATENCY_MS);

  const scenario = resolvePinDetailScenario(pinId);

  if (scenario === 'notFound') {
    throw new ApiError(404, 'PIN_NOT_FOUND', '핀을 찾을 수 없습니다.');
  }

  if (scenario !== 'owner') {
    throw new ApiError(403, 'CHAT_PIN_LEAVE_FORBIDDEN', '해당 핀의 채팅방에서 나갈 권한이 없습니다.');
  }

  // 이미 전부 LEFT면 실패가 아니라 빈 배열로 성공한다.
  const alreadyLeft = leftPinIds.has(pinId);
  leftPinIds.add(pinId);

  return {
    pinId,
    status: 'LEFT',
    leftChatRoomIds: alreadyLeft ? [] : [7],
    leftAt: new Date().toISOString(),
  };
}
