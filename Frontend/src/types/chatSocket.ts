import type { ChatRoomStatus } from './chat';

/**
 * 채팅 실시간 이벤트 타입.
 *
 * 서버가 보내는 프레임의 본문 모양이다. REST 응답과 달리 `statusCode`·`data` 껍데기가 없고
 * 이벤트 자체가 최상위에 온다.
 */

/** 소켓 연결의 현재 상태. 화면은 이 값으로 재연결 안내를 띄운다. */
export type SocketStatus =
  /** 서버 주소가 없어 소켓을 쓰지 않는 환경(목업). */
  | 'disabled'
  /** 아직 연결을 시작하지 않았거나 끊고 정리한 상태. */
  | 'idle'
  | 'connecting'
  | 'connected'
  /** 끊긴 뒤 다시 붙기를 기다리는 중. */
  | 'reconnecting';

/** 안전 경고 사유. */
export type WarningReasonCode =
  | 'EXTERNAL_MESSENGER_INDUCEMENT'
  | 'FRAUD_SCAM'
  | 'ILLEGAL_GOODS_TRADE'
  | 'ETC_SUSPICIOUS';

/** 채팅방 이벤트의 공통 껍데기(`/topic/chat/rooms/{roomId}`). */
interface ChatRoomEventBase<TType extends string, TData> {
  eventType: TType;
  roomId: number;
  occurredAt: string;
  data: TData;
}

export interface MessageCreatedData {
  messageId: number;
  senderId: number;
  /** 원본. 신고 등 뒤 처리를 위해 함께 온다. */
  content: string;
  /** 화면에 그릴 내용. 1차 욕설 필터가 적용돼 있다. */
  maskedContent: string;
  createdAt: string;
}

export interface WarningCreatedData {
  messageId: number;
  reasonCode: WarningReasonCode;
  content: string;
  createdAt: string;
}

export interface RoomStatusChangedData {
  status: ChatRoomStatus;
  /** 시스템이 바꿨으면 null. */
  changedBy: number | null;
  changedAt: string;
}

export type ChatRoomEvent =
  | ChatRoomEventBase<'MESSAGE_CREATED', MessageCreatedData>
  | ChatRoomEventBase<'WARNING_CREATED', WarningCreatedData>
  | ChatRoomEventBase<'CHAT_ROOM_STATUS_CHANGED', RoomStatusChangedData>;

/** 사용자 전용 이벤트의 공통 껍데기(`/user/queue/chat-rooms`). 방에 매이지 않는다. */
interface UserChatEventBase<TType extends string, TData> {
  eventType: TType;
  occurredAt: string;
  data: TData;
}

export interface ChatRoomUpdatedData {
  roomId: number;
  lastMessage: string;
  lastMessageAt: string;
  /** 이 이벤트를 받는 사용자 기준으로 계산된 값이다. */
  hasUnread: boolean;
}

export interface ChatRoomStatusChangedData {
  roomId: number;
  status: ChatRoomStatus;
  changedAt: string;
}

/**
 * 새 채팅 요청. 요청을 **받은** 사람에게만 온다.
 *
 * 명세의 예시 JSON과 필드 표가 어긋나 있어(`otherUserNickname` vs `requesterNickname`,
 * `lastMessage` vs `requestedAt`) 표를 기준으로 삼되 예시에만 있는 것은 선택으로 둔다.
 * 목록 이슈에서 실제 응답을 보고 좁힌다.
 */
export interface ChatRoomRequestedData {
  roomId: number;
  requesterId?: number;
  requesterNickname?: string;
  otherUserNickname?: string;
  pinId?: string;
  placeName: string;
  status: ChatRoomStatus;
  requestedAt?: string;
  lastMessage?: string;
  lastMessageAt?: string;
  hasUnread?: boolean;
}

export type UserChatEvent =
  | UserChatEventBase<'CHAT_ROOM_UPDATED', ChatRoomUpdatedData>
  | UserChatEventBase<'CHAT_ROOM_STATUS_CHANGED', ChatRoomStatusChangedData>
  | UserChatEventBase<'CHAT_ROOM_REQUESTED', ChatRoomRequestedData>;

/** 구독이 거절될 때 `/user/queue/errors`로 오는 프레임. */
export interface SubscriptionFailedEvent {
  eventType: 'SUBSCRIPTION_FAILED';
  data: { destination: string };
  error: { code: string; message: string };
}
