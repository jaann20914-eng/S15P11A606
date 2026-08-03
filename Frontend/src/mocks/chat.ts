import { ApiError } from '@/api/client';
import type { ChatDecision, ChatDecisionResult, ChatRequestResult, PinChatLeaveResult } from '@/types/chat';
import {
  MOCK_LATENCY_MS,
  canonicalMockPinId,
  delay,
  isMockPinUnlocked,
  resolvePinDetailScenario,
} from './pin';
import type { PinId } from '@/types/pin';

/**
 * 채팅 도메인 고정 데이터.
 *
 * 지금은 핀 상세의 "이미 떠났어요"만 있다. 채팅방 목록·메시지 API를 붙이면 여기에 추가한다.
 * 소유자 판정은 핀 시나리오를 그대로 쓰므로 `./pin`을 참조한다.
 */

/** 이번 세션에서 채팅을 요청한 핀 → 만들어진 방 id. 중복 요청 409를 재현한다. */
const chatRoomIdByPinId = new Map<PinId, number>();

let nextMockRoomId = 7;

/**
 * 익명 채팅 요청 목업.
 * 미구매·본인 핀(403)과 이미 대기 중인 요청(409)을 실제 서버와 같은 코드로 재현한다.
 */
export async function createMockChatRequest(pinId: PinId): Promise<ChatRequestResult> {
  // 짧은 번호로 들어와도 표·집합과 같은 키로 맞춘다.
  pinId = canonicalMockPinId(pinId);

  await delay(MOCK_LATENCY_MS);

  const scenario = resolvePinDetailScenario(pinId);

  if (scenario === 'notFound') {
    throw new ApiError(404, 'PIN_NOT_FOUND', '조회할 수 있는 핀이 없습니다.');
  }

  // 작성자 본인과 미구매자는 요청할 수 없다. 결제로 열람했으면 요청할 수 있다.
  if (scenario === 'owner' || (scenario === 'preview' && !isMockPinUnlocked(pinId))) {
    throw new ApiError(403, 'CHAT_REQUEST_FORBIDDEN', '채팅을 요청할 수 없습니다.');
  }

  // 'evaluated' 시나리오는 이미 PENDING 방을 갖고 있다.
  if (scenario === 'evaluated' || chatRoomIdByPinId.has(pinId)) {
    throw new ApiError(409, 'CHAT_REQUEST_ALREADY_EXISTS', '이미 대기 중인 요청 또는 채팅방이 있습니다.');
  }

  const roomId = nextMockRoomId++;
  chatRoomIdByPinId.set(pinId, roomId);

  return { roomId, pinId };
}

/** 이번 세션에서 이미 응답한 방. 두 번째 응답은 409를 준다. */
const decidedRoomIds = new Set<number>();

/**
 * 채팅 요청 응답 목업.
 *
 * 받은 요청 목록이 아직 목업이라 방 번호를 검증할 근거가 없다. 그래서 "없는 방"은 재현하지
 * 않고, 화면이 반드시 다뤄야 하는 "이미 처리된 요청"만 실제 서버와 같은 코드로 낸다.
 */
export async function decideMockChatRequest(
  roomId: number,
  decision: ChatDecision,
): Promise<ChatDecisionResult> {
  await delay(MOCK_LATENCY_MS);

  if (decidedRoomIds.has(roomId)) {
    throw new ApiError(409, 'CHAT_REQUEST_ALREADY_DECIDED', '이미 처리된 채팅 요청입니다.');
  }

  decidedRoomIds.add(roomId);

  return { roomId, status: decision === 'ACCEPT' ? 'ACCEPTED' : decision === 'REJECT' ? 'REJECTED' : 'LEFT' };
}

/** 이번 세션에서 이미 나간 핀. 두 번째 요청은 빈 배열을 준다. */
const leftPinIds = new Set<PinId>();

/**
 * "이미 떠났어요" 목업.
 * 권한 없음과 "이미 전부 LEFT" 두 경우를 실제 서버와 같게 재현한다.
 */
export async function leaveMockPinChats(pinId: PinId): Promise<PinChatLeaveResult> {
  // 짧은 번호로 들어와도 표·집합과 같은 키로 맞춘다.
  pinId = canonicalMockPinId(pinId);

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
