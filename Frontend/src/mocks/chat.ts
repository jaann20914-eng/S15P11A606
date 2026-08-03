import { ApiError } from '@/api/client';
import type {
  ChatDecision,
  ChatDecisionResult,
  ChatPinListItem,
  ChatRequestResult,
  ChatRoomListItem,
  CursorPage,
  CursorQuery,
  PinChatLeaveResult,
} from '@/types/chat';
import {
  MOCK_LATENCY_MS,
  canonicalMockPinId,
  delay,
  isMockPinUnlocked,
  mockPinId,
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

/**
 * 채팅방 목록 목업.
 *
 * 실제 서버가 없어 화면 흐름만 확인할 수 있게 고정 데이터를 둔다. 상태가 골고루 섞여 있어야
 * 화면이 상태별로 다르게 그려지는지 확인할 수 있으므로, 대기·진행·거절·종료를 모두 넣는다.
 *
 * `pinId`는 핀 목업의 식별자를 그대로 쓴다. 목록에서 방으로 들어간 뒤 그 핀의 상세를 열어도
 * 같은 핀으로 이어지게 하려는 것이다.
 */
const mockRooms: ChatRoomListItem[] = [
  {
    roomId: 11,
    status: 'ACTIVE',
    pinId: mockPinId(4),
    placeName: '바나프레소 역삼점',
    otherUserNickname: '역삼동 익명러',
    otherUserViewTemperature: 268,
    lastMessage: '2층 창가석 지금도 비어 있나요?',
    lastMessageAt: minutesAgo(3),
    hasUnread: true,
  },
  {
    roomId: 12,
    status: 'PENDING',
    pinId: mockPinId(4),
    placeName: '바나프레소 역삼점',
    otherUserNickname: '조용한 산책자',
    otherUserViewTemperature: 92,
    lastMessage: null,
    lastMessageAt: null,
    hasUnread: false,
  },
  {
    roomId: 13,
    status: 'ACTIVE',
    pinId: mockPinId(6),
    placeName: '성수 카페거리',
    otherUserNickname: '느긋한 오후',
    otherUserViewTemperature: 154,
    lastMessage: '알려주셔서 감사해요!',
    lastMessageAt: minutesAgo(52),
    hasUnread: false,
  },
  {
    roomId: 14,
    status: 'LEFT',
    pinId: mockPinId(6),
    placeName: '성수 카페거리',
    otherUserNickname: '지나가던 사람',
    otherUserViewTemperature: 100,
    lastMessage: '자리 옮겼어요',
    lastMessageAt: minutesAgo(180),
    hasUnread: false,
  },
  {
    roomId: 15,
    status: 'REFUSED',
    pinId: mockPinId(2),
    placeName: '뚝섬한강공원',
    otherUserNickname: '한강 러너',
    otherUserViewTemperature: 210,
    lastMessage: null,
    lastMessageAt: null,
    hasUnread: false,
  },
];

/** 받은 요청에서 먼저 고르는 게시글. 위 방 목록의 핀과 같은 것을 쓴다. */
const mockChatPins: ChatPinListItem[] = [
  {
    pinId: mockPinId(4),
    createdAt: minutesAgo(40),
    placeName: '바나프레소 역삼점',
    placeAddress: '서울 강남구 테헤란로 123 1층',
  },
  {
    pinId: mockPinId(6),
    createdAt: minutesAgo(220),
    placeName: '성수 카페거리',
    placeAddress: '서울 성동구 연무장길 45',
  },
];

/** 몇 분 전 시각. 화면의 상대 시간 표기를 확인하려면 고정 문자열보다 이게 낫다. */
function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

/**
 * 커서 한 장을 떼어 준다.
 *
 * 커서는 "다음에 시작할 위치"를 그대로 담는다. 실제 서버는 정렬 기준 값을 인코딩하지만,
 * 목업에서 확인할 것은 다음 장을 이어 붙이는 화면 동작이라 위치만으로 충분하다.
 */
function takePage<TItem>(items: TItem[], { cursor, limit }: CursorQuery): CursorPage<TItem> {
  const start = cursor === undefined ? 0 : Number(cursor);
  const size = limit ?? 20;
  const end = start + size;

  return {
    items: items.slice(start, end),
    nextCursor: end < items.length ? String(end) : null,
  };
}

/**
 * 내가 쓴 글의 방인지.
 *
 * 목업 사용자는 4·6번 핀의 주인이다(핀 목업의 `owner` 시나리오). 그 핀에 달린 방은 "요청받은
 * 대화"이고, 남의 핀에 달린 방은 "내가 요청한 대화"다.
 */
const OWN_PIN_IDS = new Set([mockPinId(4), mockPinId(6)]);

/** 내가 요청한 대화. 남의 글에 달린 방만 보인다. */
export async function listMockChatRooms(query: CursorQuery): Promise<CursorPage<ChatRoomListItem>> {
  await delay(MOCK_LATENCY_MS);

  return takePage(mockRooms.filter((room) => !OWN_PIN_IDS.has(room.pinId)), query);
}

/** 내 글 하나에 달린 방들. 여기서 수락·거절을 한다. */
export async function listMockPinChatRooms(
  pinId: PinId,
  query: CursorQuery,
): Promise<CursorPage<ChatRoomListItem>> {
  await delay(MOCK_LATENCY_MS);

  const canonical = canonicalMockPinId(pinId);
  const rooms = mockRooms.filter((room) => room.pinId === canonical);

  return takePage(rooms, query);
}

/** 요청이 온 내 글들. 요청받은 대화 탭의 첫 화면이 쓴다. */
export async function listMockChatPins(query: CursorQuery): Promise<CursorPage<ChatPinListItem>> {
  await delay(MOCK_LATENCY_MS);

  return takePage(mockChatPins, query);
}
