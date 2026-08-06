import { useEffect, useRef, useState } from 'react';
import { ApiError } from '@/api/client';
import { getTagSuggestions } from '@/api/pin/tagSearch';
import {
  MIN_PLACE_QUERY_LENGTH,
  PLACE_SEARCH_DEBOUNCE_MS,
  TAG_SUGGESTION_QUERY_MAX_LENGTH,
} from '@/types/place';
import { createDevLogger, toRequestLine } from '@/utils/devLog';
import type { MapBoundsQuery, TagSuggestion } from '@/types/place';

const log = createDevLogger('tag-suggest');

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
 * **색인은 이제 채워진다**(2026-08-06 재점검). 핀이 공개되는 순간(AI 블러 완료 →
 * `AiBlurResultService`)과 수정·삭제 시에 백엔드가 Elasticsearch `pin-tags` 색인에 반영한다
 * (`PinTagIndexingService`). 다만 색인은 best-effort고 **그 코드가 배포되기 전에 올라온
 * 핀은 색인에 없다** — 추천이 비어도 사용자가 검색을 끝낼 수 있어야 하는 것은 그대로다.
 * 화면은 **입력한 값을 그대로 태그로 확정하는 줄**을 항상 함께 둔다 — 확정(POST)은 DB를
 * 읽으므로 색인과 무관하게 찾아낸다.
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

    /*
      너무 짧으면 장소 검색과 같은 하한으로 거르고, 너무 길면 보내지 않는다 — 서버가 정규화
      후 50자를 넘는 검색어를 400으로 거절하므로(`TAG_SUGGESTION_QUERY_MAX_LENGTH`), 어차피
      거절될 요청으로 실패 로그만 쌓인다.
    */
    if (query.length < MIN_PLACE_QUERY_LENGTH || query.length > TAG_SUGGESTION_QUERY_MAX_LENGTH) {
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
        log('건너뜀 — 지도 범위 없음', { query });
        setResults([]);
        setLoading(false);
        return;
      }

      const startedAt = Date.now();
      log('요청', {
        재현: toRequestLine('GET', '/api/v1/pins/tags/search', { q: query, ...currentBounds }),
      });

      getTagSuggestions(query, currentBounds)
        .then((tags) => {
          if (latestRequest.current !== requestId) return;

          log('응답', {
            query,
            건수: tags.length,
            소요: `${Date.now() - startedAt}ms`,
            태그: tags.map((tag) => tag.name),
            // 0건의 흔한 이유를 적어 둔다. 색인 반영 전(배포 이전 핀)이거나 범위 밖이면 0건이다.
            비고:
              tags.length === 0
                ? '0건 — 지도 범위 안에 그 태그의 활성 핀이 없거나, 색인 반영 전 핀일 수 있다'
                : undefined,
          });

          setResults(tags);
          setLoading(false);
        })
        .catch((cause: unknown) => {
          if (latestRequest.current !== requestId) return;

          // 장소 결과까지 막지 않는다. 태그 칸만 비운 채 넘어간다.
          log('실패', {
            query,
            code: cause instanceof ApiError ? cause.code : 'unknown',
            statusCode: cause instanceof ApiError ? cause.statusCode : undefined,
            message: cause instanceof Error ? cause.message : String(cause),
            소요: `${Date.now() - startedAt}ms`,
          });

          setResults([]);
          setLoading(false);
        });
    }, PLACE_SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [keyword]);

  return { results, loading };
}
