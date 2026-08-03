import type { PinId } from './pin';
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
