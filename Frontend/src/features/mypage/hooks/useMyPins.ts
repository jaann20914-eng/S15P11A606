import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
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
  TODAY_PINS_FETCH_FAILED: '핀 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.',
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

/**
 * 핀이 공개되는 시간(ms). 서버 규칙은 "AI 검수 통과 시각 + 1시간"이다.
 *
 * 목록 응답에는 만료 시각(`expiresAt`)이 없어 등록 시각으로 근사한다 — 검수가 몇 초 안에
 * 끝나 오차가 작고, 이르게 "만료"로 읽는 쪽이라 만료된 글을 살아 있다고 보여주는 것보다
 * 낫다. 정확한 판정은 상세 화면이 응답의 `expiresAt`으로 한다. 서버가 목록에도 그 값을
 * 주기 시작하면 이 근사를 지운다.
 */
const PIN_LIFETIME_MS = 60 * 60 * 1000;

/** 서버 핀을 화면이 쓰는 모양으로 바꾼다. */
function toMyPin(pin: TodayPin): MyPin {
  return {
    pinId: pin.pinId,
    time: formatTimeOfDay(pin.createdAt),
    placeName: pin.placeName,
    // 주소가 비어서 오면 목록에서 그 줄을 그리지 않는다. 빈 줄이 자리만 차지한다.
    placeAddress: pin.placeAddress?.trim() ?? '',
    status: pin.status,
    // 공개된 적 없는 핀(검수 중·재촬영·실패)에는 만료라는 개념이 없다.
    expired: pin.status === 'ACTIVE' && Date.parse(pin.createdAt) + PIN_LIFETIME_MS <= Date.now(),
  };
}

/**
 * 오늘 등록한 핀 목록.
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
            : '핀 목록을 불러오지 못했어요',
        );
      });
  }, []);

  /*
    화면이 다시 보일 때마다 첫 장을 새로 받는다.

    이 목록에서 상세로 들어가 핀을 지우거나 고칠 수 있다. 돌아왔을 때 지운 핀이 그대로 남아
    있으면 삭제가 안 된 것으로 읽힌다 — 서버는 지운 핀을 목록에서 빼 주므로 다시 받으면 사라진다.

    이어 받아 둔 뒷장은 버리고 첫 장부터 다시 센다. 그러지 않으면 사라진 한 칸 때문에 커서가
    어긋나 같은 핀이 두 번 보인다.
  */
  useFocusEffect(useCallback(() => load(), [load]));

  const loadMore = useCallback(() => {
    // 첫 조회 중이거나 이미 이어 받는 중이면 겹쳐 부르지 않는다.
    if (cursor === null || loading || loadingMore) return;
    load(cursor);
  }, [cursor, loading, loadingMore, load]);

  return { pins, loading, loadingMore, hasMore: cursor !== null, error, loadMore };
}
