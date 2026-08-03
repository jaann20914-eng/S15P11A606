import { apiRequest } from '../client';
import { usesMock } from '../config';
import { fetchMockCreditTransactions } from '@/mocks/mypage';
import type { CreditTransactionsQuery, CreditTransactionsResponse } from '@/types/credit';
import { traceUser } from './log';

/**
 * 크레딧 내역 조회 — `GET /api/v1/users/me/credits/transactions`
 *
 * 잔액과 거래 목록을 함께 준다. 둘이 같은 원장에서 나오므로 화면이 따로 잔액을 물어볼 필요가
 * 없다.
 *
 * 종류·기간 필터는 서버가 처리한다. 목록은 거래 시각 내림차순이고 다음 페이지는 커서로 잇는다.
 *
 * 오류 코드: `INVALID_CREDIT_FILTER` `INVALID_PAGINATION` `UNAUTHORIZED`
 * `CREDIT_TRANSACTIONS_FETCH_FAILED`.
 */
function requestCreditTransactions(
  query: CreditTransactionsQuery,
): Promise<CreditTransactionsResponse> {
  return apiRequest<CreditTransactionsResponse>({
    method: 'GET',
    url: '/api/v1/users/me/credits/transactions',
    // 값이 없는 조건은 키째로 빼야 한다. `undefined`를 넘기면 axios가 생략해 준다.
    params: query,
  });
}

export function getCreditTransactions(
  query: CreditTransactionsQuery,
): Promise<CreditTransactionsResponse> {
  return traceUser(
    '크레딧 내역',
    'user/credits',
    () =>
      usesMock('user/credits')
        ? fetchMockCreditTransactions(query)
        : requestCreditTransactions(query),
    (page) => ({
      조건: `${query.type ?? 'all'} · ${query.period ?? '전체'}`,
      잔액: page.balance,
      건수: page.items.length,
      다음커서: page.nextCursor ?? '없음',
    }),
  );
}
