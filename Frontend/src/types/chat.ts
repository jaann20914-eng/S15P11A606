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
 * 목록이 받는 방 상태.
 *
 * **목록은 세 가지로 줄여서 준다**(서버 `ChatRoomSummaryStatus`). 거절과 나감을 `CLOSED` 하나로
 * 합치기 때문이다. 그래서 목록에서는 둘을 구분할 수 없고, 화면도 "종료된 대화"로 한 문구를 쓴다.
 *
 * 정확한 상태는 방에 들어가면 알 수 있다 — 이력 조회는 네 가지를 그대로 준다.
 */
export type ChatRoomSummaryStatus = 'PENDING' | 'ACTIVE' | 'CLOSED';

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
  /** 목록은 세 가지로 줄여서 준다. `ChatRoomSummaryStatus` 설명 참고. */
  status: ChatRoomSummaryStatus;
  pinId: PinId;
  placeName: string;
  /** 익명 정책이 적용된 상대 표시명. */
  otherUserNickname: string;
  /**
   * 상대의 공개 뷰 온도. 프로필 링에 쓰는 값과 같은 척도다.
   *
   * 목록은 `otherUserViewAngle`, 이력은 `otherUserViewTemperature`로 이름이 갈린다. 서버가
   * 섞어 쓰고 있어 각 응답의 이름을 그대로 따른다.
   */
  otherUserViewAngle: number;
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
  /** 이 글에 달린 방 중 안 읽은 것이 있는지. 줄에 점으로 표시한다. */
  hasUnread: boolean;
  /**
   * 이 글의 대화가 전부 끝났는지(모든 방이 `CLOSED`).
   *
   * 서버 응답에는 없고 방 목록으로 계산해 채운다(`api/chat/pins.ts`). 줄의 글자를 연하게
   * 눌러 굳이 들어가 볼 글이 아님을 알린다. 계산하지 못했으면(조회 실패) 없는 채로 둔다.
   */
  closed?: boolean;
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

/**
 * 안전 경고 사유.
 *
 * 이력 조회(`warnings[].reasonCode`)와 소켓 경고 이벤트가 같은 값을 쓴다. 화면은 이 값으로
 * 분기하지 않고 서버가 준 문구(`content`)를 그대로 보여준다 — 서버가 사유를 추가해도 화면은
 * 그대로 동작한다. 그래도 값을 적어 두는 것은 어떤 사유가 있는지 알아야 목업을 만들 수
 * 있고, 나중에 사유별로 아이콘을 붙일 여지를 남기기 위해서다.
 */
export type WarningReasonCode =
  'EXTERNAL_MESSENGER_INDUCEMENT' | 'FRAUD_SCAM' | 'ILLEGAL_GOODS_TRADE' | 'ETC_SUSPICIOUS';

/**
 * 메시지를 누가 보냈는지.
 *
 * 이력 조회는 서버가 이 값으로 내려준다(현재 사용자 기준). 소켓 이벤트는 `senderId`(숫자)로
 * 오므로 화면에서 이 값으로 바꿔 쓴다.
 */
export type ChatMessageSender = 'SELF' | 'OTHER';

/**
 * 채팅 메시지 한 건.
 *
 * `content`는 원본이고 `maskedContent`는 1차 욕설 필터가 적용된 화면용이다. 마스킹 대상이
 * 없으면 두 값이 같다. **화면에는 언제나 `maskedContent`를 쓴다** — 원본은 신고 등 뒷처리를
 * 위해 함께 온다.
 */
export type ChatMessage = {
  messageId: number;
  sender: ChatMessageSender;
  content: string;
  maskedContent: string;
  createdAt: string;
};

/**
 * 안전 경고 한 건.
 *
 * 위험 확정이나 제재가 아니다. 경고가 와도 원본 메시지는 지우지 않는다.
 *
 * `messageId`는 경고 자체의 식별자다(메시지 id가 아니다). 이름이 헷갈리지만 명세가 그렇다.
 * 이력 조회에는 담겨 오지만 실시간 이벤트에는 없어 선택으로 둔다 — 같은 경고를 두 번 붙이지
 * 않으려고 쓰는 값이라, 없으면 도착 시각으로 가린다.
 */
export type ChatWarning = {
  messageId?: number;
  reasonCode: WarningReasonCode;
  content: string;
  createdAt: string;
};

/**
 * 채팅방 이력 조회 `data`.
 *
 * 방 정보(상태·장소·상대)와 메시지·경고를 한 번에 준다. 화면이 헤더를 그리려고 목록을 다시
 * 뒤질 필요가 없고, 목록을 거치지 않고 바로 들어온 경우에도 헤더가 채워진다.
 */
export type ChatRoomHistory = {
  status: ChatRoomStatus;
  placeName: string;
  address: string;
  /**
   * 상대의 공개 뷰 온도(각도).
   *
   * 명세에는 `otherUserViewAngle`로 적혀 있지만 실제 응답은 `otherUserViewTemperature`다.
   * 목록 API도 같은 이름을 쓰므로 서버 쪽이 일관된 이름이다.
   */
  otherUserViewTemperature: number;
  otherUserNickname: string;
  /** 생성 시각 오름차순. 없으면 빈 배열. */
  messages: ChatMessage[];
  /** 생성 시각 오름차순. 없으면 빈 배열. */
  warnings: ChatWarning[];
};

/**
 * 읽음 위치 갱신 결과 `data`.
 *
 * 갱신 뒤 서버에 저장된 값이다. 보낸 값보다 작거나 같으면 서버가 그대로 둔 값이 온다 —
 * 되돌리지 않기 때문이다(멱등).
 */
export type ChatReadResult = {
  roomId: number;
  lastReadMessageId: number;
};
