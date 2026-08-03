import { apiRequest } from '../client';
import { usesMock } from '../config';
import { toPinCard } from '../place/detail';
// 태그 목업은 장소 목업의 시드·핀 카드 변환기를 그대로 쓴다. 응답이 장소 핀 카드와 같아서다.
import { fetchMockTaggedPins, searchMockTags } from '@/mocks/place';
import type {
  MapBoundsQuery,
  PlacePinCard,
  TagSearchResponse,
  TaggedPinsResponse,
  TagSuggestion,
} from '@/types/place';

/**
 * 태그 자동완성 — `GET /api/v1/pins/tags/search`
 *
 * **확정 조회가 아니다.** 같은 URI의 POST와 역할이 다르다 — 이쪽은 입력 중에 부르는 추천이고
 * 태그 이름만 돌려준다. 명세 문서가 둘을 한 장에 섞어 놓아 혼동하기 쉬우므로, 구분은 서버
 * `TagController`를 기준으로 한다.
 *
 * 지도 경계가 필요하다. 서버가 그 범위 안의 활성·미만료 핀에 달린 태그만 후보로 삼기
 * 때문이다 — 결과가 하나도 없는 태그를 제안하지 않으려는 설계다.
 *
 * 오류 코드: `INVALID_TAG_NAME` `INVALID_MAP_RANGE` `UNAUTHORIZED` `TAG_SEARCH_FAILED`.
 */
export async function getTagSuggestions(query: string, bounds: MapBoundsQuery): Promise<TagSuggestion[]> {
  const trimmed = query.trim();

  if (usesMock('pin/tag-search')) return searchMockTags(trimmed);

  const response = await apiRequest<TagSearchResponse>({
    method: 'GET',
    url: '/api/v1/pins/tags/search',
    params: { q: trimmed, ...bounds },
  });

  return response.tags;
}

/**
 * 태그 검색 확정 — `POST /api/v1/pins/tags/search`
 *
 * 태그를 고른 순간 부른다. 지도 경계 안에서 그 태그와 **정확히 일치하는** 활성 핀 목록을
 * 돌려준다(부분일치는 자동완성 단계에서만 쓴다). 최신 작성순이다.
 *
 * POST지만 Body가 없다 — `tag`와 경계 좌표를 모두 **쿼리 파라미터**로 받는다(`@RequestParam`).
 * 명세 문서에 Body로 읽힐 여지가 있어 적어 둔다.
 *
 * 핀 카드는 장소 상세와 같은 모양이라 `PlacePinCard` 컴포넌트를 그대로 쓸 수 있다.
 *
 * 검색 이력은 서버가 저장한다(`search_type = TAG`). 결과가 비어 있어도 저장한다 — 사용자가
 * 실제로 검색한 행위이기 때문이다.
 *
 * 오류 코드: `INVALID_TAG_NAME` `INVALID_MAP_RANGE` `UNAUTHORIZED` `TAGGED_PINS_FETCH_FAILED`.
 */
export async function searchPinsByTag(tag: string, bounds: MapBoundsQuery): Promise<PlacePinCard[]> {
  // 서버도 정규화하지만, 검색 이력에 남는 값이므로 보내기 전에 맞춰 둔다.
  const normalized = tag.trim().replace(/^#/, '');

  if (usesMock('pin/tag-pins')) {
    const mocked = await fetchMockTaggedPins(normalized);
    return mocked.pins.map(toPinCard);
  }

  const response = await apiRequest<TaggedPinsResponse>({
    method: 'POST',
    url: '/api/v1/pins/tags/search',
    params: { tag: normalized, ...bounds },
  });

  return response.pins.map(toPinCard);
}
