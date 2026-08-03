import { apiRequest } from '../client';
import { usesMock } from '../config';
import { toPinCard } from './detail';
import { confirmMockPlaceSearch } from '@/mocks/place';
import type { PlaceSearchConfirmResponse, PlaceSearchConfirmResult } from '@/types/place';

function toConfirmResult(response: PlaceSearchConfirmResponse): PlaceSearchConfirmResult {
  return { ...response, pins: response.pins.map(toPinCard) };
}

/**
 * 장소 검색 확정 — `POST /api/v1/places/search/{kakaoPlaceId}`
 *
 * 추천 목록에서 장소를 고른 순간 부른다. 검색 결과(`GET /places/search`)는 카카오 장소라
 * 우리 `placeId`가 없는데, 이 API가 그 간극을 메운다 — `kakaoPlaceId`를 주면 서버가 우리 DB를
 * 뒤져 장소 상세와 **같은 응답**(기본정보 · 활성 핀 · 요일별 혼잡 통계)을 돌려준다.
 *
 * DB에 없는 장소면 `place.placeId`가 `null`이고 `pins`·`weeklyCrowdStats`는 빈 배열이다.
 * 오류가 아니라 "아직 아무도 핀을 남기지 않은 장소"라는 뜻이므로 화면은 정상 처리해야 한다.
 *
 * `placeName`은 Body로 보낸다. 서버가 DB에 없는 장소를 카카오 키워드 검색으로 다시 찾을 때
 * 쓰고, 검색 이력의 `keyword`로도 저장한다.
 *
 * **좌표는 없다.** 장소 상세와 마찬가지로 지도에 찍을 위도·경도는 따로 구해야 한다
 * (`coordinates.ts`). 다만 검색 결과 항목(`PlaceSearchItem`)이 좌표를 가지고 있으므로,
 * 이 API를 부른 화면은 고른 항목의 좌표를 그대로 들고 가는 편이 빠르다.
 *
 * 검색 이력은 서버가 저장한다(`search_type = PLACE`). 실패해도 응답을 막지 않으므로
 * 프론트가 따로 남길 것은 없다.
 *
 * 오류 코드: `INVALID_PLACE_SEARCH_QUERY` `UNAUTHORIZED` `PLACE_NOT_FOUND`(DB·카카오 양쪽에
 * 없음) `EXTERNAL_PLACE_API_ERROR` `EXTERNAL_PLACE_API_UNAVAILABLE` `PLACE_DETAIL_FETCH_FAILED`.
 */
export async function confirmPlaceSearch(
  kakaoPlaceId: string,
  placeName: string,
): Promise<PlaceSearchConfirmResult> {
  if (usesMock('place/search-confirm')) {
    return toConfirmResult(await confirmMockPlaceSearch(kakaoPlaceId, placeName));
  }

  const response = await apiRequest<PlaceSearchConfirmResponse>({
    method: 'POST',
    url: `/api/v1/places/search/${encodeURIComponent(kakaoPlaceId)}`,
    data: { placeName },
  });

  return toConfirmResult(response);
}
