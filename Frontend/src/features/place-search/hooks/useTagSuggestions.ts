import { useEffect, useRef, useState } from 'react';
import { getTagSuggestions } from '@/api/pin/tagSearch';
import { MIN_PLACE_QUERY_LENGTH, PLACE_SEARCH_DEBOUNCE_MS } from '@/types/place';
import type { MapBoundsQuery, TagSuggestion } from '@/types/place';

/** 개발 중 태그 추천이 어디서 끊겼는지 터미널에서 따라갈 수 있게 한다. */
function logTags(step: string, detail?: Record<string, unknown>): void {
  if (!__DEV__) return;
  console.log(`[tag-search] ${step}`, detail ?? '');
}

export interface TagSuggestionsState {
  results: TagSuggestion[];
  loading: boolean;
}

/**
 * 입력 중인 검색어로 태그를 추천한다 — `GET /api/v1/pins/tags/search`
 *
 * 장소 검색(`usePlaceSearch`)과 **나란히** 돈다. 사용자는 장소를 찾는지 태그를 찾는지 미리
 * 고르지 않고 그냥 입력하므로, 두 갈래를 한 번에 물어보고 결과를 함께 보여준다. 디바운스와
 * 최소 길이를 장소 검색과 같은 값으로 맞춰 두 목록이 같은 순간에 바뀌게 한다.
 *
 * **⚠ 지금은 거의 늘 빈 배열이 온다.** 이 API는 Elasticsearch의 태그 색인을 읽는데
 * (`TagSearchService`), 백엔드에 그 색인에 쓰는 코드가 없다 — 핀을 등록하면 태그가 MySQL의
 * `pin_tag`에만 저장된다(`PinPersistenceService`). 그래서 추천을 못 받아도 사용자가 검색을
 * 끝낼 수 있어야 한다. 화면은 **입력한 값을 그대로 태그로 확정하는 줄**을 항상 함께 둔다 —
 * 확정(POST)은 DB를 읽으므로 방금 등록한 핀도 찾아낸다.
 *
 * 실패를 밖으로 내보내지 않는다. 태그는 검색의 한쪽 갈래일 뿐이라 이쪽이 안 되더라도 장소
 * 결과는 그대로 쓸 수 있어야 한다. 원인은 로그로만 남긴다.
 */
export function useTagSuggestions(keyword: string, bounds: MapBoundsQuery | null): TagSuggestionsState {
  const [results, setResults] = useState<TagSuggestion[]>([]);
  const [loading, setLoading] = useState(false);

  /** 늦게 도착한 응답이 최신 결과를 덮지 않도록 마지막 요청만 반영한다. */
  const latestRequest = useRef(0);

  /*
    경계는 지도를 움직일 때마다 바뀐다. 의존성에 넣으면 지도를 미는 동안 추천이 계속 다시
    나가므로 ref로 읽는다. 장소 검색이 대체 좌표를 다루는 방식과 같다.
  */
  const boundsRef = useRef(bounds);
  boundsRef.current = bounds;

  useEffect(() => {
    const query = keyword.trim();

    if (query.length < MIN_PLACE_QUERY_LENGTH) {
      latestRequest.current += 1;
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const requestId = latestRequest.current + 1;
    latestRequest.current = requestId;

    const timer = setTimeout(() => {
      const currentBounds = boundsRef.current;

      if (currentBounds === null) {
        logTags('건너뜀 — 지도 범위 없음', { query });
        setResults([]);
        setLoading(false);
        return;
      }

      getTagSuggestions(query, currentBounds)
        .then((tags) => {
          if (latestRequest.current !== requestId) return;

          logTags('응답', { query, 건수: tags.length, 태그: tags.map((tag) => tag.name) });
          setResults(tags);
          setLoading(false);
        })
        .catch((cause: unknown) => {
          if (latestRequest.current !== requestId) return;

          // 장소 결과까지 막지 않는다. 태그 칸만 비운 채 넘어간다.
          logTags('실패', {
            query,
            message: cause instanceof Error ? cause.message : String(cause),
          });
          setResults([]);
          setLoading(false);
        });
    }, PLACE_SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [keyword]);

  return { results, loading };
}
