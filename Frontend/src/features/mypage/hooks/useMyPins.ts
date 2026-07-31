import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/api/client';
import { getTodayPins } from '@/api/user/todayPins';
import type { MyPin } from '@/types/mypage';
import type { TodayPin } from '@/types/pin';
import { formatTimeOfDay } from '@/utils/datetime';
import { withMinimumDuration } from '@/utils/promise';

export interface MyPinsState {
  pins: MyPin[];
  loading: boolean;
  /** 다음 페이지를 받는 중인지. 첫 조회와 구분해 목록을 비우지 않는다. */
  loadingMore: boolean;
  /** 더 받을 페이지가 있는지. 개수 표기에도 쓴다. */
  hasMore: boolean;
  /** 실패 문구. 성공하면 null. */
  error: string | null;
  /** 다음 페이지를 이어 받는다. 받을 것이 없으면 아무 일도 하지 않는다. */
  loadMore: () => void;
}

/** 오류 코드별 안내. */
const messageByCode: Record<string, string> = {
  INVALID_PAGINATION: '목록을 더 불러오지 못했어요.',
  UNAUTHORIZED: '로그인이 필요해요.',
  TODAY_PINS_FETCH_FAILED: '영상핀 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.',
};

/**
 * 한 번에 받아오는 개수.
 *
 * 명세의 서버 기본값과 같게 두었다(최댓값 50). 목록이 그리는 단위와도 맞춰야 한다 —
 * `FlatList` 기본 렌더 묶음은 10이라 한 페이지가 두 번에 나눠 그려지면 스피너가 끼었다 빠진다.
 */
export const TODAY_PIN_PAGE_SIZE = 20;

/** 첫 조회에서 로딩 표시를 최소한 이만큼 유지한다. 이유는 `withMinimumDuration` 참고. */
const MIN_LOADING_MS = 500;

/** 서버 핀을 화면이 쓰는 모양으로 바꾼다. */
function toMyPin(pin: TodayPin): MyPin {
  return {
    pinId: pin.pinId,
    time: formatTimeOfDay(pin.createdAt),
    placeName: pin.placeName,
    // 주소가 비어서 오면 목록에서 그 줄을 그리지 않는다. 빈 줄이 자리만 차지한다.
    placeAddress: pin.placeAddress?.trim() ?? '',
    status: pin.status,
  };
}

/**
 * 오늘 등록한 영상핀 목록.
 *
 * "오늘"의 범위는 서버가 정한다. Asia/Seoul 오전 4시 경계라 자정 직후 등록한 핀도 전날
 * 목록에 들어가는데, 프론트가 날짜를 계산하면 그 경계와 어긋난다.
 */
export function useMyPins(): MyPinsState {
  const [pins, setPins] = useState<MyPin[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** 지금 유효한 조회의 번호. 뒤늦게 도착한 앞선 응답을 버리는 데 쓴다. */
  const requestId = useRef(0);

  const load = useCallback((next?: string) => {
    const id = requestId.current + 1;
    requestId.current = id;

    const more = next !== undefined;
    if (more) setLoadingMore(true);
    else setLoading(true);
    setError(null);

    const request = getTodayPins({ cursor: next, limit: TODAY_PIN_PAGE_SIZE });

    // 첫 조회만 최소 시간을 지킨다. 이어 받기는 늦추지 않는다.
    (more ? request : withMinimumDuration(request, MIN_LOADING_MS))
      .then((page) => {
        if (requestId.current !== id) return;

        const received = page.items.map(toMyPin);
        setPins((current) => (more ? [...current, ...received] : received));
        setCursor(page.nextCursor);
        setLoading(false);
        setLoadingMore(false);
      })
      .catch((cause: unknown) => {
        if (requestId.current !== id) return;

        setLoading(false);
        setLoadingMore(false);
        setError(
          cause instanceof ApiError
            ? (messageByCode[cause.code] ?? cause.message)
            : '영상핀 목록을 불러오지 못했어요',
        );
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const loadMore = useCallback(() => {
    // 첫 조회 중이거나 이미 이어 받는 중이면 겹쳐 부르지 않는다.
    if (cursor === null || loading || loadingMore) return;
    load(cursor);
  }, [cursor, loading, loadingMore, load]);

  return { pins, loading, loadingMore, hasMore: cursor !== null, error, loadMore };
}
