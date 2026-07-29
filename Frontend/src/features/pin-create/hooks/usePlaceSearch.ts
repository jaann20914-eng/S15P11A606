import { useCallback, useEffect, useRef, useState } from 'react';
import { searchMockPlaces } from '@/mocks/place';
import type { PinDraftPlace } from '@/types/pinCreate';

/** 입력이 멈춘 뒤 검색을 보내기까지 기다리는 시간. 글자마다 요청이 나가는 것을 막는다. */
const DEBOUNCE_MS = 350;

export interface PlaceSearch {
  keyword: string;
  setKeyword: (value: string) => void;
  results: PinDraftPlace[];
  loading: boolean;
  /** 검색은 했지만 결과가 없는 상태. 안내 문구를 띄울지 판단한다. */
  empty: boolean;
  /** 목록을 닫는다. 장소를 고른 뒤에 쓴다. */
  clear: () => void;
}

/**
 * 키워드로 주변 장소를 찾는다.
 *
 * 사용자가 입력을 멈추면 검색을 보낸다. 서버가 붙으면 여기에 현재 좌표를 함께 실어
 * `GET /api/v1/places/search`를 호출한다.
 */
export function usePlaceSearch(): PlaceSearch {
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<PinDraftPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  /** 늦게 도착한 응답이 최신 결과를 덮어쓰지 않도록 마지막 요청만 반영한다. */
  const latestRequest = useRef(0);

  useEffect(() => {
    const query = keyword.trim();

    if (!query) {
      setResults([]);
      setSearched(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    const requestId = latestRequest.current + 1;
    latestRequest.current = requestId;

    const timer = setTimeout(() => {
      searchMockPlaces(query)
        .then((found) => {
          if (latestRequest.current !== requestId) return;
          setResults(found);
          setSearched(true);
          setLoading(false);
        })
        .catch(() => {
          if (latestRequest.current !== requestId) return;
          setResults([]);
          setSearched(true);
          setLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [keyword]);

  const clear = useCallback(() => {
    setKeyword('');
    setResults([]);
    setSearched(false);
  }, []);

  return {
    keyword,
    setKeyword,
    results,
    loading,
    empty: searched && !loading && results.length === 0,
    clear,
  };
}
