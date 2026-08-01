import type { RecommendationsResponse, RecommendedPlace } from '@/types/recommend';

/**
 * 목록에서 이미 받아 둔 추천 장소.
 *
 * 상세는 별도 화면이라 목록의 상태를 물려받지 못한다. 그렇다고 들어갈 때마다 추천을 다시
 * 부르면 화면 하나 여는 데 왕복이 한 번 더 생기고, 그 사이 추천이 새로 계산되면 방금 누른
 * 카드와 다른 내용이 열린다.
 *
 * 그래서 목록이 받은 응답을 여기 적어 두고 상세가 그대로 읽는다. 캐시가 비어 있는 경우
 * (앱을 상세 주소로 바로 열었을 때)에만 상세가 직접 조회한다.
 *
 * 목록을 다시 받으면 같은 `placeId`를 덮어쓴다. 화면 수명과 무관한 모듈 수준 저장이지만
 * 장소 수가 수십 개라 그대로 두어도 문제가 없다.
 */
const placeById = new Map<number, RecommendedPlace>();

/** 추천 응답에 담긴 장소를 전부 기억한다. 계열(여유·와글) 구분 없이 한 곳에 모은다. */
export function rememberRecommendedPlaces(response: RecommendationsResponse): void {
  for (const places of Object.values(response.recommendations)) {
    for (const place of places) placeById.set(place.placeId, place);
  }
}

/** 기억해 둔 장소. 없으면 null. */
export function recallRecommendedPlace(placeId: number): RecommendedPlace | null {
  return placeById.get(placeId) ?? null;
}

/** 응답 안에서 장소 하나를 찾는다. 두 계열을 모두 뒤진다. */
export function findRecommendedPlace(
  response: RecommendationsResponse,
  placeId: number,
): RecommendedPlace | null {
  for (const places of Object.values(response.recommendations)) {
    const found = places.find((place) => place.placeId === placeId);
    if (found) return found;
  }
  return null;
}
