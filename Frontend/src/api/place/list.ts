import { apiRequest } from '../client';
import { usesMock } from '../config';
import { fetchMockPlaces } from '@/mocks/place';
import { createDevLogger, toRequestLine } from '@/utils/devLog';
import type { PlacesQuery, PlacesResponse } from '@/types/place';

const log = createDevLogger('place-list');

/**
 * 필터를 걸지 않을 때 `filter`에 보내는 값.
 *
 * **서버는 `filter`를 필수로 받는다** — `PlaceController.getPlaces`의 `@RequestParam String filter`에
 * `required = false`가 없다(바로 위 `radius`에는 붙어 있으니 의도된 차이다). 빼고 보내면
 * 서비스에 닿기도 전에 Spring이 400을 낸다.
 *
 * 그런데 값이 비어 있으면 `PlaceFilter.from`이 `null`을 돌려주고, `matchesFilter`는 필터가
 * `null`이면 전부 통과시킨다. 즉 **"파라미터는 있고 값은 빈 것"이 곧 필터 미적용**이다.
 * 그래서 빈 문자열을 보낸다. axios는 `undefined`·`null`만 쿼리에서 빼고 빈 문자열은
 * `filter=`로 남기므로 이 값이 그대로 실린다.
 *
 * 필터를 걸면 **평균 혼잡도가 없는 장소가 빠진다**(`matchesFilter`는 `average == null`을
 * 탈락시킨다). 활성 핀이 없는 장소를 찾아야 하는 호출부는 필터를 지정하면 안 된다.
 */
const NO_FILTER = '';

/**
 * 지도 범위 내 장소·활성핀 목록 — `GET /api/v1/places`
 *
 * 지도 경계 네 좌표를 함께 보낸다. 남서가 북동보다 작아야 하며, 어기면 `INVALID_MAP_RANGE`가
 * 온다. `filter`는 생략해도 되지만 그건 호출부 사정이고, 서버로는 항상 실어 보낸다
 * (`NO_FILTER` 참고).
 *
 * 좌표를 주는 유일한 엔드포인트다. 장소 상세(`/places/{placeId}`)에는 위도·경도가 없어
 * 지도에 장소를 찍으려면 이쪽을 거쳐야 한다(`coordinates.ts`).
 *
 * 결과는 **최대 10건**이고 활성 핀이 많은 순 → 지도 중심에 가까운 순이다
 * (`PlacePinService.MAX_RESULT`). 거리순이 아니므로 넓게 물으면 찾는 장소가 밀려날 수 있다.
 *
 * 오류 코드: `INVALID_MAP_RANGE` `INVALID_PLACE_FILTER` `UNAUTHORIZED` `PLACES_FETCH_FAILED`.
 */
export async function getPlaces(query: PlacesQuery): Promise<PlacesResponse> {
  if (usesMock('place/list')) return fetchMockPlaces(query);

  // 경계 좌표와 필터를 나눠 조립한다. `query`를 그대로 넘기면 필터가 빠진 채 나간다.
  const { filter, ...bounds } = query;
  const params = { ...bounds, filter: filter ?? NO_FILTER };

  log('요청', { 요청: toRequestLine('GET', '/api/v1/places', params) });

  const response = await apiRequest<PlacesResponse>({
    method: 'GET',
    url: '/api/v1/places',
    params,
  });

  log('응답', {
    장소: response.places.length,
    활성핀: response.places.reduce((total, place) => total + place.activePins.length, 0),
    // 0건은 그 범위에 장소가 없다는 뜻일 수도, 필터에 다 걸러졌다는 뜻일 수도 있다.
    비고: response.places.length === 0 && filter !== undefined ? `필터(${filter}) 적용됨` : undefined,
  });

  return response;
}
