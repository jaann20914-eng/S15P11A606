import { useCallback, useRef, useState } from 'react';
import { ApiError } from '@/api/client';
import { getNearbyPlaces } from '@/api/place/nearby';
import { useCurrentLocation } from '@/hooks/useCurrentLocation';
import type { PlaceSearchItem } from '@/types/place';
import { createDevLogger } from '@/utils/devLog';

const log = createDevLogger('place-nearby');

export interface NearbyPlaces {
  /** 지금 자리의 장소들. 가까운 순이다. 아직 찾지 않았으면 빈 배열. */
  places: PlaceSearchItem[];
  /** 한 번이라도 찾아봤는지. 누르기 전에는 목록 자리를 비워 둔다. */
  asked: boolean;
  loading: boolean;
  /** 실패 문구. 성공하면 null. */
  error: string | null;
  /** 다시 눌러 볼 만한 실패인지. 권한 문제는 눌러도 같은 결과라 버튼을 두지 않는다. */
  retryable: boolean;
  /** 찾았지만 주변에 아무것도 없었는지. */
  empty: boolean;
  /** 현재 위치를 잡고 그 자리의 장소를 찾는다. */
  find: () => void;
  /** 목록을 닫고 처음 상태로 돌린다. */
  reset: () => void;
}

/** 오류 코드별 안내. */
const messageByCode: Record<string, string> = {
  UNAUTHORIZED: '로그인이 필요해요.',
  EXTERNAL_PLACE_API_UNAVAILABLE: '장소를 찾는 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.',
};

/** 재시도가 뜻이 있는 오류. 그 밖에는 눌러도 같은 결과가 나온다. */
const RETRYABLE_CODES = new Set(['EXTERNAL_PLACE_API_UNAVAILABLE']);

/**
 * 지금 서 있는 자리의 장소 후보.
 *
 * 이름을 입력받지 않는다. 처음 가 본 곳에서 장소 이름을 떠올려 적는 일이 등록에서 가장 걸리는
 * 단계였다. 버튼을 누르면 좌표를 잡고 그 자리의 장소를 거리순으로 보여준다.
 *
 * **누를 때만 좌표를 읽는다.** 화면에 들어오자마자 권한을 묻는 것은 사용자가 시작하지 않은
 * 일이라 맥락이 없다(`useCurrentLocation` 주석 참고).
 */
export function useNearbyPlaces(): NearbyPlaces {
  const [places, setPlaces] = useState<PlaceSearchItem[]>([]);
  const [asked, setAsked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryable, setRetryable] = useState(false);

  const { request: requestLocation, message: locationMessage } = useCurrentLocation();

  /** 버튼 연타로 요청이 겹치는 것을 막는다. */
  const inFlight = useRef(false);

  const find = useCallback(() => {
    if (inFlight.current) return;
    inFlight.current = true;

    setAsked(true);
    setLoading(true);
    setError(null);
    setRetryable(false);

    requestLocation()
      .then(async (coordinate) => {
        log('좌표 단계 끝', { 좌표: coordinate === null ? '없음' : '확보' });

        if (coordinate === null) {
          /*
            좌표가 없으면 장소를 물어볼 수 없다. 이유는 위치 훅이 알고 있으므로 그 문구를 쓴다 —
            권한 거부와 위치 서비스 꺼짐은 사용자가 할 일이 달라서, 한 문구로 뭉치면 무엇을
            고쳐야 할지 알 수 없다.
          */
          setError(locationMessage ?? '현재 위치를 확인하지 못했어요.');
          setPlaces([]);
          return;
        }

        const found = await getNearbyPlaces(coordinate.latitude, coordinate.longitude);

        log('장소 조회 성공', { 건수: found.length });
        setPlaces(found);
      })
      .catch((cause: unknown) => {
        const code = cause instanceof ApiError ? cause.code : null;

        log('장소 조회 실패', { 코드: code ?? '없음' });

        setPlaces([]);
        setRetryable(code !== null && RETRYABLE_CODES.has(code));
        setError(
          code !== null
            ? (messageByCode[code] ?? (cause as ApiError).message)
            : '장소를 찾지 못했어요. 잠시 후 다시 시도해 주세요.',
        );
      })
      .finally(() => {
        setLoading(false);
        inFlight.current = false;
      });
  }, [requestLocation, locationMessage]);

  return {
    places,
    asked,
    loading,
    error,
    retryable,
    empty: asked && !loading && error === null && places.length === 0,
    find,
    reset: useCallback(() => {
      setAsked(false);
      setPlaces([]);
      setError(null);
      setRetryable(false);
    }, []),
  };
}
