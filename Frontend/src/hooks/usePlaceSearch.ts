import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/api/client';
import { searchPlaces } from '@/api/place/search';
import { readCurrentCoordinate } from '@/utils/location';
import { MIN_PLACE_QUERY_LENGTH, PLACE_SEARCH_DEBOUNCE_MS } from '@/types/place';
import type { PlaceSearchItem, PlaceSearchOptions } from '@/types/place';
import type { Coordinate } from '@/store/useMapStore';
import { createDevLogger, toRequestLine } from '@/utils/devLog';
import type { LocationFailure } from '@/utils/location';

/**
 * 좌표를 얻지 못했을 때의 안내.
 *
 * 세 경우가 사용자가 할 일이 서로 다르다 — 설정에서 위치 서비스를 켜는 것, 권한을 허용하는 것,
 * 잠시 뒤 다시 시도하는 것. 예전에는 하나로 뭉쳐 있어 무엇을 해야 하는지 알 수 없었다.
 */
const LOCATION_MESSAGE: Record<LocationFailure, string> = {
  disabled: '기기의 위치 서비스를 켜야 주변 장소를 찾을 수 있어요.',
  denied: '위치 권한을 허용해야 주변 장소를 찾을 수 있어요.',
  failed: '현재 위치를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.',
};

const log = createDevLogger('place-search');

/** 서버에 나가는 값 그대로. 로그와 실제 요청이 어긋나지 않게 한곳에서 만든다. */
interface SearchRequest {
  q: string;
  latitude: number;
  longitude: number;
  radius?: number;
}

/**
 * 백엔드 담당자가 그대로 붙여 재현할 수 있는 경로.
 *
 * 로그에 파라미터를 흩어 적으면 읽는 사람이 다시 조립해야 한다. 원인이 서버에 있을 때
 * 가장 빨리 확인하는 방법은 같은 요청을 직접 쏘는 것이므로 완성된 형태로 남긴다.
 */
function toRequestPath(request: SearchRequest): string {
  return toRequestLine('GET', '/api/v1/places/search', { ...request });
}

/**
 * 응답이 어떤 순서인지 판정한다.
 *
 * 서버는 카카오에 `sort=accuracy`로 요청한 뒤 `distanceMeters` 오름차순으로 다시 정렬한다
 * (`PlaceService`). 그래서 넓은 반경에서는 검색어와의 관련도가 사라지고 가까운 것이 위로 온다.
 *
 * 이 판정을 로그에 남기는 이유는 두 가지다. 결과가 엉뚱해 보일 때 그게 정렬 때문인지
 * 바로 알 수 있고, 나중에 서버가 정렬을 고치면 이 값이 저절로 바뀌어 반영 여부가 확인된다.
 */
function describeOrder(places: PlaceSearchItem[]): string {
  if (places.length < 2) return '판정 불가(1건 이하)';

  const ascending = places.every(
    (place, index) => index === 0 || places[index - 1].distanceMeters <= place.distanceMeters,
  );

  return ascending ? '거리 오름차순 — 서버가 관련도 순서를 덮어씀' : '거리순 아님(관련도 순서 유지)';
}

export interface PlaceSearch {
  keyword: string;
  setKeyword: (value: string) => void;
  results: PlaceSearchItem[];
  loading: boolean;
  /** 검색은 했지만 결과가 없는 상태. */
  empty: boolean;
  /** 실패 문구. 위치 권한 거부와 검색 실패를 함께 다룬다. */
  error: string | null;
  /** 다시 시도할 값이 있는 실패인지. 외부 장소 API 장애가 여기 해당한다. */
  retryable: boolean;
  retry: () => void;
  /** 목록을 닫는다. 장소를 고른 뒤에 쓴다. */
  clear: () => void;
}

/**
 * 키워드로 주변 장소를 찾는다.
 *
 * 명세대로 입력이 멈춘 뒤 700ms를 기다리고, 앞뒤 공백을 지운 검색어가 2자 이상일 때만
 * 요청한다.
 *
 * 좌표는 회원가입 때 받은 위치 권한으로 바로 읽는다. 이 화면에서는 권한을 다시 묻지 않는다.
 *
 * 핀 등록(주변에서 고르기)과 홈 검색바(가려는 곳 찾기)가 함께 쓴다. 두 용도는 찾는 범위가
 * 정반대라 반경만 `options.radius`로 달리 준다 — 나머지 동작은 같다.
 *
 * 핀 등록은 반경을 주지 않는다. 그러면 서버가 50m로 고정하고, 그 범위가 곧 등록 가능한
 * 장소의 범위가 된다(등록 요청의 촬영 좌표도 장소에서 50m 이내여야 한다).
 */
export function usePlaceSearch({
  radius,
  fallbackCoordinate,
}: PlaceSearchOptions = {}): PlaceSearch {
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<PlaceSearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryable, setRetryable] = useState(false);
  /** 재시도 버튼을 누르면 값이 바뀌어 검색을 다시 돌린다. */
  const [retryCount, setRetryCount] = useState(0);

  /** 한 번 읽은 좌표는 이 화면에 있는 동안 재사용한다. 검색마다 GPS를 켜지 않는다. */
  const coordinateRef = useRef<Coordinate | null>(null);

  /** 늦게 도착한 응답이 최신 결과를 덮지 않도록 마지막 요청만 반영한다. */
  const latestRequest = useRef(0);

  /*
    대체 좌표는 지도를 움직일 때마다 바뀐다. effect 의존성에 넣으면 지도를 미는 동안
    검색이 계속 다시 나가므로 ref로 읽는다.
  */
  const fallbackRef = useRef(fallbackCoordinate);
  fallbackRef.current = fallbackCoordinate;

  const reset = useCallback(() => {
    setResults([]);
    setSearched(false);
    setLoading(false);
    setError(null);
    setRetryable(false);
  }, []);

  useEffect(() => {
    const query = keyword.trim();

    if (query.length < MIN_PLACE_QUERY_LENGTH) {
      reset();
      return;
    }

    setLoading(true);
    setError(null);
    setRetryable(false);

    const requestId = latestRequest.current + 1;
    latestRequest.current = requestId;

    const timer = setTimeout(() => {
      const cached = coordinateRef.current;

      /*
        좌표가 없으면 권한을 묻는다. 확인만 하면 온보딩을 건너뛴 계정은 권한을 받은 적이
        없어 검색이 영구히 실패하고, 사용자는 그 이유를 알 방법이 없다.
      */
      const resolveCoordinate = cached
        ? Promise.resolve({ coordinate: cached })
        : readCurrentCoordinate({ requestPermission: true });

      /** 실패 로그에도 같은 값을 남기려면 요청을 effect 바깥 범위에 들고 있어야 한다. */
      let sent: SearchRequest | null = null;
      const startedAt = Date.now();

      Promise.resolve(resolveCoordinate)
        .then((located) => {
          if (latestRequest.current !== requestId) return null;

          let coordinate: Coordinate;
          /** 거리 계산의 기준점. distanceMeters를 해석하려면 이게 무엇이었는지 알아야 한다. */
          let source: string;

          if ('failure' in located) {
            /*
              기기 위치를 못 얻었다. 대체 좌표가 있으면 그것으로 계속한다 — 거리 표기의
              기준이 달라지지만, 검색 자체를 막는 것보다는 낫다. 대체 좌표는 캐시하지 않는다.
            */
            const fallback = fallbackRef.current;
            if (!fallback) {
              log('중단 — 좌표 없음', { failure: located.failure, 대체좌표: '없음' });
              setLoading(false);
              setError(LOCATION_MESSAGE[located.failure]);
              // 권한·위치 서비스는 사용자가 설정을 바꿔야 하므로 그 자리의 재시도로는 풀리지 않는다.
              setRetryable(located.failure === 'failed');
              return null;
            }
            coordinate = fallback;
            source = `지도 중심(기기 위치 ${located.failure})`;
          } else {
            coordinate = located.coordinate;
            coordinateRef.current = coordinate;
            source = cached ? '기기 위치(캐시)' : '기기 위치';
          }

          const request: SearchRequest = { q: query, ...coordinate, radius };
          sent = request;

          log('요청', {
            radius: radius ?? '보내지 않음(서버 기본 50m)',
            좌표출처: source,
            요청: toRequestPath(request),
          });

          return searchPlaces(query, coordinate.latitude, coordinate.longitude, radius);
        })
        .then((found) => {
          if (latestRequest.current !== requestId || found === null) return;

          log('응답', {
            건수: found.length,
            소요: `${Date.now() - startedAt}ms`,
            거리범위:
              found.length > 0
                ? `${found[0].distanceMeters}m ~ ${found[found.length - 1].distanceMeters}m`
                : '해당 없음',
            정렬: describeOrder(found),
            // 관련도가 맞는지는 사람이 봐야 판단된다. 상위 세 건만 이름과 거리로 남긴다.
            상위3: found.slice(0, 3).map((place) => `${place.name} (${place.distanceMeters}m)`),
          });

          setResults(found);
          setSearched(true);
          setLoading(false);
        })
        .catch((cause: unknown) => {
          if (latestRequest.current !== requestId) return;

          log('실패', {
            code: cause instanceof ApiError ? cause.code : 'unknown',
            statusCode: cause instanceof ApiError ? cause.statusCode : undefined,
            message: cause instanceof Error ? cause.message : String(cause),
            소요: `${Date.now() - startedAt}ms`,
            // 서버 쪽 원인일 때 담당자가 그대로 재현할 수 있도록 보낸 요청을 남긴다.
            재현: sent ? toRequestPath(sent) : '요청 전 단계에서 실패',
          });

          setResults([]);
          setSearched(false);
          setLoading(false);

          /*
            외부 장소 API 장애는 잠시 뒤 다시 시도할 값이 있다.

            명세가 정하는 값은 503 `EXTERNAL_PLACE_API_UNAVAILABLE` 하나다. 502
            `EXTERNAL_PLACE_API_ERROR`는 예전 명세의 값인데, 서버가 아직 그것을 보낼 수도
            있어 남겨 둔다. 안 오게 되면 이 줄만 지우면 된다.
          */
          setRetryable(
            cause instanceof ApiError &&
              (cause.code === 'EXTERNAL_PLACE_API_UNAVAILABLE' ||
                cause.code === 'EXTERNAL_PLACE_API_ERROR'),
          );
          setError(cause instanceof Error ? cause.message : '장소를 찾지 못했어요');
        });
    }, PLACE_SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [keyword, radius, retryCount, reset]);

  const clear = useCallback(() => {
    latestRequest.current += 1;
    setKeyword('');
    reset();
  }, [reset]);

  return {
    keyword,
    setKeyword,
    results,
    loading,
    empty: searched && !loading && results.length === 0,
    error,
    retryable,
    retry: useCallback(() => setRetryCount((count) => count + 1), []),
    clear,
  };
}
