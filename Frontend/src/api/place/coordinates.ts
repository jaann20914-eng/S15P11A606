import { getPlaces } from './list';
import type { PlaceListItem } from '@/types/place';
import { DEFAULT_CENTER, type Coordinate } from '@/store/useMapStore';

/**
 * 장소 좌표 저장소.
 *
 * 좌표를 주는 곳은 목록(`GET /api/v1/places`) 하나뿐이다. 장소 상세에는 위도·경도가 없고
 * 추천 응답에도 없다. 그래서 목록으로 한 번 받아 둔 좌표를 여기 모아 두고, 상세처럼 좌표가
 * 필요한 화면이 꺼내 쓴다.
 */
const coordinateByPlaceId = new Map<number, Coordinate>();

/**
 * 지도에 찍을 수 있는 좌표인지.
 *
 * 숫자가 아니거나 범위를 벗어난 값을 그대로 넘기면 카카오 지도는 중심을 잡지 못하고 **엉뚱한
 * 기본 위치(제주 앞바다)** 를 보여준다. 그 화면은 "지도가 이상한 데를 가리킨다"로만 보이고
 * 값이 잘못 왔다는 사실은 드러나지 않는다. 그래서 경계에서 걸러 낸다.
 *
 * `0, 0`도 버린다. 좌표가 비어 있을 때 흔히 채워지는 값인데, 실제로는 기니만 앞바다다.
 */
export function isPlottableCoordinate(coordinate: {
  latitude: number;
  longitude: number;
}): boolean {
  const { latitude, longitude } = coordinate;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  if (latitude < -90 || latitude > 90) return false;
  if (longitude < -180 || longitude > 180) return false;
  return latitude !== 0 || longitude !== 0;
}

/** 목록 응답에 담긴 좌표를 기억한다. 쓸 수 없는 좌표는 넣지 않는다. */
export function rememberPlaceCoordinates(places: PlaceListItem[]): void {
  for (const place of places) {
    const coordinate = { latitude: place.latitude, longitude: place.longitude };
    if (!isPlottableCoordinate(coordinate)) {
      if (__DEV__) console.warn(`[place] 좌표를 쓸 수 없습니다: placeId=${place.placeId}`, coordinate);
      continue;
    }
    coordinateByPlaceId.set(place.placeId, coordinate);
  }
}

/** 기억해 둔 좌표. 없으면 null. */
export function recallPlaceCoordinate(placeId: number): Coordinate | null {
  return coordinateByPlaceId.get(placeId) ?? null;
}

/**
 * 좌표를 모를 때 훑어 볼 범위(위경도 도 단위). 약 ±11km로, 서울 안에서 움직이는 범위를 덮는다.
 *
 * 목록 API는 지도 경계로 조회하는 API라 "이 장소 하나만" 물어볼 방법이 없다. 상세 화면에는
 * 지도 경계라 할 것이 없으니 기준점 주변을 넓게 훑어 그 안에서 `placeId`를 찾는다.
 *
 * 장소 상세 응답에 위도·경도가 실리면 이 우회는 통째로 사라진다. 그때는 `getPlaceDetail`이
 * 준 좌표를 그대로 쓰면 된다.
 */
const LOOKUP_SPAN_DEGREES = 0.1;

/**
 * 장소 하나의 좌표를 구한다.
 *
 * 이미 받아 둔 값이 있으면 그대로 쓰고, 없으면 기준점 주변을 목록 API로 훑는다. 기준점은
 * 사용자의 현재 위치이며, 없으면 기본 중심(서울숲)이다.
 *
 * 찾지 못해도 예외를 던지지 않는다. 좌표는 화면의 일부(지도)만 좌우하므로, 없으면 지도 자리만
 * 비우고 기본정보와 핀 목록은 그대로 보여주는 편이 낫다.
 */
export async function resolvePlaceCoordinate(
  placeId: number,
  near?: Coordinate | null,
): Promise<Coordinate | null> {
  const remembered = recallPlaceCoordinate(placeId);
  if (remembered !== null) return remembered;

  const center = near ?? DEFAULT_CENTER;

  try {
    const { places } = await getPlaces({
      southWestLatitude: center.latitude - LOOKUP_SPAN_DEGREES,
      southWestLongitude: center.longitude - LOOKUP_SPAN_DEGREES,
      northEastLatitude: center.latitude + LOOKUP_SPAN_DEGREES,
      northEastLongitude: center.longitude + LOOKUP_SPAN_DEGREES,
    });
    rememberPlaceCoordinates(places);
  } catch {
    // 좌표를 못 구한 것뿐이다. 화면은 지도 없이 나머지를 보여준다.
    return null;
  }

  return recallPlaceCoordinate(placeId);
}
