import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { ApiError } from '@/api/client';
import { searchPlaces } from '@/api/place/search';
import { MIN_PLACE_QUERY_LENGTH, PLACE_SEARCH_DEBOUNCE_MS } from '@/types/place';
import type { PlaceSearchItem } from '@/types/place';

/**
 * 기기의 현재 좌표를 읽는다.
 *
 * 위치 권한은 회원가입 단계에서 받으므로 여기서 다시 묻지 않는다. 권한이 이미 있으면
 * 바로 좌표가 나온다. 사용자가 나중에 설정에서 껐다면 실패하고, 그때만 안내 문구를 띄운다.
 */
async function readCoordinate(): Promise<Location.LocationObjectCoords | null> {
  try {
    const servicesEnabled = await Location.hasServicesEnabledAsync();
    const permission = await Location.getForegroundPermissionsAsync();

    if (!servicesEnabled) {
      console.warn('[place-search] 기기의 위치 서비스가 꺼져 있습니다.');
      return null;
    }
    if (!permission.granted) {
      console.warn('[place-search] 전경 위치 권한이 없습니다.');
      return null;
    }

    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    console.info('[place-search] 검색에 사용하는 기기 좌표', {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    });
    return position.coords;
  } catch (cause) {
    console.error('[place-search] 현재 좌표 취득 실패', cause);
    return null;
  }
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
 * 요청한다. 반경은 서버가 50m로 고정하므로 보내지 않는다.
 *
 * 좌표는 회원가입 때 받은 위치 권한으로 바로 읽는다. 이 화면에서는 권한을 다시 묻지 않는다.
 */
export function usePlaceSearch(): PlaceSearch {
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<PlaceSearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryable, setRetryable] = useState(false);
  /** 재시도 버튼을 누르면 값이 바뀌어 검색을 다시 돌린다. */
  const [retryCount, setRetryCount] = useState(0);

  /** 한 번 읽은 좌표는 이 화면에 있는 동안 재사용한다. 검색마다 GPS를 켜지 않는다. */
  const coordinateRef = useRef<Location.LocationObjectCoords | null>(null);

  /** 늦게 도착한 응답이 최신 결과를 덮지 않도록 마지막 요청만 반영한다. */
  const latestRequest = useRef(0);

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
      const resolveCoordinate = cached ? Promise.resolve(cached) : readCoordinate();

      resolveCoordinate
        .then((position) => {
          if (latestRequest.current !== requestId) return null;

          if (!position) {
            setLoading(false);
            setError('현재 위치를 확인할 수 없어요. 위치 서비스를 켜고 다시 시도해 주세요.');
            setRetryable(true);
            return null;
          }

          coordinateRef.current = position;
          return searchPlaces(query, position.latitude, position.longitude);
        })
        .then((found) => {
          if (latestRequest.current !== requestId || found === null) return;

          setResults(found);
          setSearched(true);
          setLoading(false);
        })
        .catch((cause: unknown) => {
          if (latestRequest.current !== requestId) return;

          setResults([]);
          setSearched(false);
          setLoading(false);

          // 외부 장소 API 장애는 잠시 뒤 다시 시도할 값이 있다.
          setRetryable(cause instanceof ApiError && cause.code === 'EXTERNAL_PLACE_API_UNAVAILABLE');
          setError(cause instanceof Error ? cause.message : '장소를 찾지 못했어요');
        });
    }, PLACE_SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [keyword, retryCount, reset]);

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
