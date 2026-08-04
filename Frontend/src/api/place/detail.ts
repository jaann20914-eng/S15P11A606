import { apiRequest } from '../client';
import { usesMock } from '../config';
import { fetchMockPlaceDetail } from '@/mocks/place';
import type { PlaceDetail, PlaceDetailResponse, PlacePinCard, PlacePinCardResponse } from '@/types/place';

/**
 * 핀 카드의 썸네일 필드를 하나로 모은다.
 *
 * 명세의 JSON 예시(`thumbnailKey`)와 필드 표(`videoThumbnailUrl`)가 서로 달라 어느 쪽이 올지
 * 확정되지 않았다. 둘 다 받아 두고 화면에는 `thumbnailUrl` 하나만 넘긴다. 키로 온다면
 * 저장소 주소를 앞에 붙이는 자리도 여기다.
 */
export function toPinCard({
  videoThumbnailUrl,
  thumbnailKey,
  latitude,
  longitude,
  ...pin
}: PlacePinCardResponse): PlacePinCard {
  return {
    ...pin,
    thumbnailUrl: videoThumbnailUrl ?? thumbnailKey ?? null,
    // 서버는 아직 좌표를 주지 않는다. 없으면 null로 못 박아 화면이 있는 척하지 않게 한다.
    latitude: latitude ?? null,
    longitude: longitude ?? null,
  };
}

function toPlaceDetail(response: PlaceDetailResponse): PlaceDetail {
  return { ...response, pins: response.pins.map(toPinCard) };
}

/**
 * 장소 상세 — `GET /api/v1/places/{placeId}`
 *
 * 기본정보 · 활성 핀 카드 · 요일별 혼잡 통계를 한 번에 준다. 장소·핀·통계 중 하나라도
 * 실패하면 서버가 부분 응답을 주지 않으므로 화면도 전부 아니면 전부로 다룬다.
 *
 * **좌표는 없다.** 지도에 찍을 위도·경도는 `coordinates.ts`가 목록 API로 따로 구한다.
 *
 * 오류 코드: `INVALID_PLACE_ID` `UNAUTHORIZED` `PLACE_NOT_FOUND` `PLACE_DETAIL_FETCH_FAILED`.
 */
export async function getPlaceDetail(placeId: number): Promise<PlaceDetail> {
  if (usesMock('place/detail')) return toPlaceDetail(await fetchMockPlaceDetail(placeId));

  const response = await apiRequest<PlaceDetailResponse>({
    method: 'GET',
    url: `/api/v1/places/${placeId}`,
  });

  return toPlaceDetail(response);
}
