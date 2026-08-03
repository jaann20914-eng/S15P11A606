import type { PinId } from './pin';
/**
 * 채팅 도메인 타입.
 *
 * 핀 상세에서 부르는 "이미 떠났어요"부터 시작한다.
 * 채팅방 목록·메시지 API를 붙이면 여기에 추가한다.
 */

/**
 * 채팅방 상태. 서버의 `chat_room_status_type`과 같은 값이다.
 *
 * PENDING(요청 대기) → ACTIVE(수락) 또는 REFUSED(거절), 그 뒤 LEFT(나감).
 * 한때 `CLOSED`로 적어 두었는데 그런 값은 없다 — 거절은 `REFUSED`, 종료는 `LEFT`다.
 */
export type ChatRoomStatus = 'PENDING' | 'ACTIVE' | 'REFUSED' | 'LEFT';

/**
 * 익명 채팅 요청 응답 `data`.
 *
 * 요청이 곧 채팅방 생성이다. 수락 전(`PENDING`)에도 `roomId`가 발급된다. 상태는 따로 오지
 * 않는다 — 이 API로 만들어진 방은 언제나 `PENDING`이라 서버가 되풀이하지 않는다.
 */
export type ChatRequestResult = {
  roomId: number;
  pinId: PinId;
};

/**
 * 요청을 받은 사람이 내리는 결정.
 *
 * `LEFT`는 수락하지 않고 그 요청에서 손을 떼는 경우다. 핀 상세의 "이미 떠났어요"(핀에 걸린
 * 모든 방을 한 번에 정리)와는 다르다 — 이쪽은 방 하나에 대한 응답이다.
 */
export type ChatDecision = 'ACCEPT' | 'REJECT' | 'LEFT';

/** 요청 응답 결과 `data`. 상태는 결정을 반영한 완료형으로 온다. */
export type ChatDecisionResult = {
  roomId: number;
  status: 'ACCEPTED' | 'REJECTED' | 'LEFT';
};

/**
 * 목록을 어느 쪽에서 보는지.
 *
 * `sent`는 내가 요청한 대화, `received`는 내가 요청받은 대화다. 명세의 필드 표에는 빠져 있지만
 * 규칙과 오류 코드(`INVALID_CHAT_ROOM_DIRECTION`·`INVALID_CHAT_PIN_DIRECTION`)가 이 값을
 * 전제로 하므로 필수로 보낸다.
 */
export type ChatDirection = 'sent' | 'received';

/**
 * 커서 방식 목록.
 *
 * 페이지 번호가 아니라 "다음 시작점"을 받는다. 목록이 실시간으로 갱신되는 화면이라, 번호
 * 방식이면 앞쪽에 새 항목이 끼어들 때 다음 페이지에서 같은 항목을 다시 받는다.
 */
export type CursorPage<TItem> = {
  items: TItem[];
  /** 다음 페이지가 없으면 null. */
  nextCursor: string | null;
};

/** 목록 조회에 함께 보내는 값. 둘 다 선택이며 없으면 서버 기본값을 쓴다. */
export type CursorQuery = {
  cursor?: string;
  limit?: number;
};

/**
 * 채팅방 목록의 한 줄.
 *
 * 내 채팅방 목록과 특정 핀의 채팅방 목록이 같은 모양을 쓴다.
 */
export type ChatRoomListItem = {
  roomId: number;
  status: ChatRoomStatus;
  pinId: PinId;
  placeName: string;
  /** 익명 정책이 적용된 상대 표시명. */
  otherUserNickname: string;
  /** 상대의 공개 뷰 온도. 프로필 링에 쓰는 값과 같은 척도다. */
  otherUserViewTemperature: number;
  /** 메시지가 아직 없으면 null. */
  lastMessage: string | null;
  lastMessageAt: string | null;
  /** 안 읽은 메시지가 있는지. 받는 사람 기준으로 계산된 값이다. */
  hasUnread: boolean;
};

/**
 * 받은 요청에서 먼저 고르는 게시글 한 줄.
 *
 * 요청이 여러 개 와도 핀은 한 번만 나온다. 핀을 고르면 그 핀의 채팅방 목록으로 들어간다.
 */
export type ChatPinListItem = {
  pinId: PinId;
  /** 핀을 등록한 시각. 목록은 이 값의 내림차순이다. */
  createdAt: string;
  placeName: string;
  placeAddress: string;
};

/**
 * "핀 떠났어요" 응답 `data`.
 *
 * 핀에 연결된 모든 채팅방(`PENDING`·`ACTIVE`·`CLOSED`)을 `LEFT`로 바꾼 결과다.
 * 핀 자체의 상태와 크레딧 거래는 바뀌지 않는다.
 */
export type PinChatLeaveResult = {
  pinId: PinId;
  status: 'LEFT';
  /** 이번 요청으로 `LEFT`가 된 채팅방. 이미 전부 `LEFT`였으면 빈 배열이다. */
  leftChatRoomIds: number[];
  leftAt: string;
};
