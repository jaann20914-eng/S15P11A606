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

/** 경계의 남북 너비(m). 로그에만 쓴다 — 0건일 때 범위 탓인지 가리는 값이다. */
function spanMeters({ southWestLatitude, northEastLatitude }: MapBoundsQuery): number {
  return (northEastLatitude - southWestLatitude) * 111_320;
}

/** 오류 코드별 안내. 태그 칸에 그대로 적는다. */
const messageByCode: Record<string, string> = {
  INVALID_TAG_SEARCH_QUERY: '태그 검색 조건이 올바르지 않아요.',
  UNAUTHORIZED: '로그인이 필요해요.',
  TAG_SEARCH_FAILED: '태그를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.',
};

export interface TagSuggestionsState {
  results: TagSuggestion[];
  loading: boolean;
  /**
   * 추천을 받아오지 못한 이유. 성공했으면 null.
   *
   * **삼키지 않는다.** 예전에는 실패해도 목록만 비웠는데, 그러면 화면이 "요청을 못 보냈다"
   * ·"실패했다"·"후보가 0건이다" **세 경우를 똑같이** 그렸다 — 태그가 안 뜬다는 신고를 받고도
   * 어느 쪽인지 가릴 수 없어 같은 곳을 세 번 들여다봤다(2026-08-07). 화면이 구분해 적는다.
   */
  error: string | null;
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
  const [error, setError] = useState<string | null>(null);

  /** 늦게 도착한 응답이 최신 결과를 덮지 않도록 마지막 요청만 반영한다. */
  const latestRequest = useRef(0);

  /*
    경계는 지도를 움직일 때마다 바뀐다. 의존성에 넣으면 지도를 미는 동안 추천이 계속 다시
    나가므로 ref로 읽는다. 장소 검색이 대체 좌표를 다루는 방식과 같다.
  */
  const boundsRef = useRef(bounds);
  boundsRef.current = bounds;

  /*
    **경계가 있는지 없는지만 의존성에 넣는다.**

    값을 넣으면 지도가 멈출 때마다 추천이 다시 나가고, ref로만 읽으면 아직 경계가 없을 때
    한 번 건너뛴 뒤 **영영 다시 묻지 않는다** — 지도가 첫 idle을 보내기 전에 검색으로 들어오면
    그 검색어로는 추천이 끝내 비어 있었다. 없다가 생기는 그 한 번만 다시 돈다.
  */
  const hasBounds = bounds !== null;

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
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const requestId = latestRequest.current + 1;
    latestRequest.current = requestId;

    const timer = setTimeout(() => {
      const currentBounds = boundsRef.current;

      if (currentBounds === null) {
        log('건너뜀 — 지도 범위 없음', { query });
        setResults([]);
        // 화면에 적는다. 비워 두면 "후보가 없다"로 읽혀 원인을 찾을 수 없다.
        setError('지도가 준비된 뒤에 태그를 추천할 수 있어요.');
        setLoading(false);
        return;
      }

      const startedAt = Date.now();
      log('요청', {
        재현: toRequestLine('GET', '/api/v1/pins/tags/search', { q: query, ...currentBounds }),
        /*
          훑는 너비. 서버는 이 사각형 안의 활성 핀에 달린 태그만 후보로 삼으므로, 0건일 때
          "범위가 좁아서"인지 "그 태그의 활성 핀이 없어서"인지 이 값으로 갈린다.
        */
        너비: `${Math.round(spanMeters(currentBounds) / 1000)}km`,
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
                ? '0건 — 이 범위 안에 그 태그의 활성 핀이 없다(색인에 없거나 만료). 만료는 지금 1시간'
                : undefined,
          });

          setResults(tags);
          setError(null);
          setLoading(false);
        })
        .catch((cause: unknown) => {
          if (latestRequest.current !== requestId) return;

          // 장소 결과까지 막지는 않는다. 태그 칸에만 이유를 적는다.
          log('실패', {
            query,
            code: cause instanceof ApiError ? cause.code : 'unknown',
            statusCode: cause instanceof ApiError ? cause.statusCode : undefined,
            message: cause instanceof Error ? cause.message : String(cause),
            소요: `${Date.now() - startedAt}ms`,
          });

          setResults([]);
          setError(
            cause instanceof ApiError
              ? (messageByCode[cause.code] ?? cause.message)
              : '태그를 불러오지 못했어요',
          );
          setLoading(false);
        });
    }, PLACE_SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [hasBounds, keyword]);

  return { results, loading, error };
}
