/**
 * 크레딧 도메인 서버 계약.
 *
 * `GET /api/v1/users/me/credits/transactions` 응답을 그대로 옮겼다. 화면이 쓰는 모양은
 * `types/mypage.ts`의 `CreditEntry`에 따로 두고 훅에서 변환한다.
 */

/**
 * 거래 사유.
 *
 * 백엔드 `CreditTransactionType`을 그대로 옮겼다. 명세 예시에는 `PIN_UNLOCK`이 적혀 있지만
 * 백엔드 enum에는 없고 열람은 `VIDEO_VIEWED`다.
 *
 * 화면은 이 값으로 분기하지 않는다. 표시 문구는 서버가 `description`으로 내려주므로, 서버가
 * 새 유형을 추가해도 화면은 그대로 동작한다.
 */
export type CreditTransactionType =
  | 'WELCOME_BONUS'
  | 'PIN_EVALUATION_PARTICIPATED'
  | 'RECEIVED_CHAT_REQUEST_ACCEPTED'
  | 'SENT_CHAT_REQUEST_ACCEPTED'
  | 'VIDEO_VIEWED'
  | 'RECEIVED_HELPFUL_PIN_EVALUATION'
  | 'RECEIVED_DISAPPOINTING_PIN_EVALUATION';

/** 거래 한 건. 원장은 수정하지 않으므로 취소도 반대 거래로 들어온다. */
export interface CreditTransaction {
  transactionId: number;
  type: CreditTransactionType;
  /** 적립은 양수, 사용은 음수. */
  amount: number;
  /** 이 거래가 반영된 직후 잔액. */
  balanceAfter: number;
  /** 화면에 그대로 보여주는 문구. */
  description: string;
  /** ISO 8601. */
  createdAt: string;
}

/** 응답의 `data`. 목록은 거래 시각 내림차순이다. */
export interface CreditTransactionsResponse {
  /** 지금 잔액. 원장 기준이라 `/users/me`의 `creditBalance`와 같은 값이다. */
  balance: number;
  items: CreditTransaction[];
  /** 다음 페이지가 없으면 `null`. */
  nextCursor: string | null;
}

/**
 * 조회 조건.
 *
 * 서버가 종류와 기간을 모두 걸러 준다. 커서 페이지네이션이라 화면에서 걸러 내면 페이지마다
 * 남는 개수가 달라져 목록이 들쭉날쭉해진다.
 */
export interface CreditTransactionsQuery {
  /** 생략하면 `all`. */
  type?: 'all' | 'spent' | 'earned';
  /** 생략하면 전체 기간. */
  period?: 'today' | 'week' | 'month';
  /** 이전 응답의 `nextCursor`만 넣는다. */
  cursor?: string;
  limit?: number;
}
