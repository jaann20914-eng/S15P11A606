import { apiRequest } from '../client';
import { usesMock } from '../config';
import { fetchMockTodayPins } from '@/mocks/mypage';
import type { TodayPinsQuery, TodayPinsResponse } from '@/types/pin';
import { traceUser } from './log';

/**
 * 오늘 등록한 영상핀 목록 — `GET /api/v1/users/me/pins/today`
 *
 * 본인이 등록한 핀만 최신순으로 온다. "오늘"의 범위는 서버가 정한다 — Asia/Seoul 오전 4시부터
 * 다음 날 오전 4시 직전까지라, 자정 직후에 등록한 핀도 전날 목록에 들어간다. 프론트가 날짜를
 * 계산하면 이 경계와 어긋난다.
 *
 * 오류 코드: `INVALID_PAGINATION` `UNAUTHORIZED` `TODAY_PINS_FETCH_FAILED`.
 */
function requestTodayPins(query: TodayPinsQuery): Promise<TodayPinsResponse> {
  return apiRequest<TodayPinsResponse>({
    method: 'GET',
    url: '/api/v1/users/me/pins/today',
    params: query,
  });
}

export function getTodayPins(query: TodayPinsQuery): Promise<TodayPinsResponse> {
  return traceUser(
    '오늘 등록한 영상핀',
    'user/today-pins',
    () => (usesMock('user/today-pins') ? fetchMockTodayPins(query) : requestTodayPins(query)),
    (page) => ({
      건수: page.items.length,
      상태: page.items.map((pin) => pin.status).join(', ') || '없음',
      다음커서: page.nextCursor ?? '없음',
    }),
  );
}
