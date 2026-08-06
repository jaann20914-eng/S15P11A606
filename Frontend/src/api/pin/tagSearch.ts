import { apiRequest } from '../client';
import { usesMock } from '../config';
import { fetchMockTaggedPlaces, searchMockTags } from '@/mocks/place';
import type { MapBoundsQuery, TagSearchResponse, TaggedPlacesResponse, TagSuggestion } from '@/types/place';

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
 * 서버는 검색어를 소문자로 정규화해 맞추고, 결과는 원래 표기로 돌려준다(`TagSuggestion`).
 * 정규화 후 비어 있거나 50자를 넘으면 400이다 — 확정(POST)과 오류 코드가 다르다.
 *
 * 오류 코드: `INVALID_TAG_SEARCH_QUERY` `UNAUTHORIZED` `TAG_SEARCH_FAILED`.
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
 * 태그를 고른 순간 부른다. 지도 경계 안에서 그 태그와 **정확히 일치하는** 활성 핀을
 * **장소별로 묶어** 돌려준다(부분일치는 자동완성 단계에서만 쓴다).
 *
 * **응답 모양이 바뀌었다**(2026-08-05 재점검). 예전에는 핀 카드 목록(`pins`)이었고 좌표가 없어
 * 결과를 지도에 찍을 수 없었는데, 지금은 `{ tag, places[] }`로 오고 장소 좌표와 그 태그가 달린
 * 활성 핀 좌표가 함께 담긴다(`TaggedPlaceItem` · `ActivePinResponse`). 대신 작성자·메모·태그·
 * 썸네일은 오지 않으므로 **이 결과로 핀 카드를 그릴 수는 없다** — 장소를 보여주고 상세로 보낸다.
 *
 * POST지만 Body가 없다 — `tag`와 경계 좌표를 모두 **쿼리 파라미터**로 받는다(`@RequestParam`).
 * 명세 문서에 Body로 읽힐 여지가 있어 적어 둔다.
 *
 * 검색 이력은 서버가 저장한다(`search_type = TAG`). 결과가 비어 있어도 저장한다 — 사용자가
 * 실제로 검색한 행위이기 때문이다.
 *
 * 오류 코드: `INVALID_TAG_NAME` `INVALID_MAP_RANGE` `UNAUTHORIZED` `TAGGED_PINS_FETCH_FAILED`.
 */
export async function searchPlacesByTag(tag: string, bounds: MapBoundsQuery): Promise<TaggedPlacesResponse> {
  // 서버도 정규화하지만, 검색 이력에 남는 값이므로 보내기 전에 맞춰 둔다.
  const normalized = tag.trim().replace(/^#/, '');

  if (usesMock('pin/tag-pins')) return fetchMockTaggedPlaces(normalized);

  return apiRequest<TaggedPlacesResponse>({
    method: 'POST',
    url: '/api/v1/pins/tags/search',
    params: { tag: normalized, ...bounds },
  });
}
