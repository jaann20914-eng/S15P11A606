/**
 * 채팅 도메인 타입.
 *
 * 핀 상세에서 부르는 "이미 떠났어요"부터 시작한다.
 * 채팅방 목록·메시지 API를 붙이면 여기에 추가한다.
 */

/** 채팅방 상태. 요청 직후는 `PENDING`이고 작성자가 수락하면 `ACTIVE`가 된다. */
export type ChatRoomStatus = 'PENDING' | 'ACTIVE' | 'CLOSED' | 'LEFT';

/**
 * 익명 채팅 요청 응답 `data`.
 *
 * 요청이 곧 채팅방 생성이다. 수락 전(`PENDING`)에도 `roomId`가 발급된다.
 */
export type ChatRequestResult = {
  roomId: number;
  pinId: number;
  status: 'PENDING';
  createdAt: string;
};

/**
 * "핀 떠났어요" 응답 `data`.
 *
 * 핀에 연결된 모든 채팅방(`PENDING`·`ACTIVE`·`CLOSED`)을 `LEFT`로 바꾼 결과다.
 * 핀 자체의 상태와 크레딧 거래는 바뀌지 않는다.
 */
export type PinChatLeaveResult = {
  pinId: number;
  status: 'LEFT';
  /** 이번 요청으로 `LEFT`가 된 채팅방. 이미 전부 `LEFT`였으면 빈 배열이다. */
  leftChatRoomIds: number[];
  leftAt: string;
};
