import { getPlaces } from './list';
import { ApiError } from '../client';
import { createDevLogger } from '@/utils/devLog';
import { distanceBetween } from '@/utils/location';
import type { PlaceActivePin, PlaceListItem } from '@/types/place';
import { DEFAULT_CENTER, type Coordinate } from '@/store/useMapStore';

const log = createDevLogger('place-coords');

/**
 * 장소의 지도 정보 저장소.
 *
 * 좌표를 주는 곳은 목록(`GET /api/v1/places`) 하나뿐이다. 장소 상세에는 위도·경도가 없고
 * (장소도, 핀도) 추천 응답에도 없다. 그래서 목록으로 한 번 받아 둔 것을 여기 모아 두고,
 * 상세처럼 지도가 필요한 화면이 꺼내 쓴다.
 */

/** 지도가 한 장소를 그리는 데 필요한 것. */
export interface PlaceMapData {
  coordinate: Coordinate;
  /** 최근 1시간 이내의 활성 핀. 각자 자기 좌표를 가진다. */
  activePins: PlaceActivePin[];
  /**
   * 최근 1시간 평균 혼잡 단계(1~4). 집계할 핀이 없거나 좌표만 아는 경우 null.
   *
   * **마커 색이 이 값으로 갈린다.** 좌표와 같은 사정이다 — 장소 상세 응답에는 지금 이 장소가
   * 얼마나 붐비는지가 없고(요일별 통계는 요청 시각 ±30분 창의 요일 평균이라 다른 값이다),
   * 목록(`GET /places`)만 준다. 홈 마커와 상세의 핀 마커가 **같은 값으로 칠해져야** 화면을
   * 옮길 때 색이 바뀌지 않는다.
   */
  averageCrowdLevel: number | null;
}

const mapDataByPlaceId = new Map<number, PlaceMapData>();

/**
 * 지도에 찍을 수 있는 좌표인지.
 *
 * 숫자가 아니거나 범위를 벗어난 값을 그대로 넘기면 카카오 지도는 중심을 잡지 못하고 **엉뚱한
 * 기본 위치(제주 앞바다)** 를 보여준다. 그 화면은 "지도가 이상한 데를 가리킨다"로만 보이고
 * 값이 잘못 왔다는 사실은 드러나지 않는다. 그래서 경계에서 걸러 낸다.
 *
 * `0, 0`도 버린다. 좌표가 비어 있을 때 흔히 채워지는 값인데, 실제로는 기니만 앞바다다.
 */
export function isPlottableCoordinate(coordinate: { latitude: number; longitude: number }): boolean {
  const { latitude, longitude } = coordinate;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  if (latitude < -90 || latitude > 90) return false;
  if (longitude < -180 || longitude > 180) return false;
  return latitude !== 0 || longitude !== 0;
}

/**
 * 좌표를 담아 오는 응답에서 이 저장소가 읽는 것.
 *
 * 목록(`PlaceListItem`)과 태그 검색 결과(`TaggedPlace`)가 **좌표 부분만 같은 모양**이다.
 * 필요한 것만 좁혀 두면 두 응답이 같은 함수를 쓸 수 있다 — 태그 결과로 들어온 장소도 상세
 * 화면이 지도에 찍을 수 있어야 한다. 혼잡도는 목록에만 있어 선택으로 둔다.
 */
export type PlaceMapSource = Pick<PlaceListItem, 'placeId' | 'latitude' | 'longitude' | 'activePins'> &
  Partial<Pick<PlaceListItem, 'averageCrowdLevel'>>;

/** 좌표가 담긴 응답을 기억한다. 쓸 수 없는 좌표는 넣지 않는다. */
export function rememberPlaceMapData(places: readonly PlaceMapSource[]): void {
  for (const place of places) {
    const coordinate = { latitude: place.latitude, longitude: place.longitude };
    if (!isPlottableCoordinate(coordinate)) {
      if (__DEV__) console.warn(`[place] 좌표를 쓸 수 없습니다: placeId=${place.placeId}`, coordinate);
      continue;
    }

    // 핀 좌표도 같은 기준으로 거른다. 하나가 깨져도 나머지는 그린다.
    const plottablePins = place.activePins.filter(isPlottableCoordinate);

    /*
      걸러진 핀은 소리 내고 지나간다. 조용히 빠지면 "지도에 마커가 하나 모자란다"로만 보여서,
      서버가 안 보낸 것인지 좌표가 깨져 우리가 버린 것인지 가릴 수 없다(2026-08-05에 실제로
      그 구분이 필요했다).
    */
    if (__DEV__ && plottablePins.length !== place.activePins.length) {
      const dropped = place.activePins.filter((pin) => !isPlottableCoordinate(pin));
      console.warn(
        `[place] 좌표가 깨져 지도에서 뺀 핀: placeId=${place.placeId}`,
        dropped.map((pin) => ({ pinId: pin.pinId, lat: pin.latitude, lng: pin.longitude })),
      );
    }

    mapDataByPlaceId.set(place.placeId, {
      coordinate,
      activePins: plottablePins,
      // 혼잡도를 담지 않는 응답(태그 검색)도 있다. 그때는 모르는 채로 둔다 — 마커는 기본색이 된다.
      averageCrowdLevel: place.averageCrowdLevel ?? null,
    });
  }
}

/** 기억해 둔 지도 정보. 없으면 null. */
export function recallPlaceMapData(placeId: number): PlaceMapData | null {
  return mapDataByPlaceId.get(placeId) ?? null;
}

/**
 * 장소 좌표를 알 때 물어볼 범위(위경도 도 단위). 약 ±330m로, 그 장소와 바로 옆만 들어온다.
 *
 * 목록 API는 지도 경계로 묻는 API지만, 어디인지 알고 있으면 그 자리를 경계로 삼으면 된다.
 * 좁게 물을수록 정확하다 — 서버가 **활성 핀이 많은 순**으로 최대 10건만 주고 거리는 동점일
 * 때만 보므로(`PlacePinService`), 넓게 물으면 정작 찾는 장소가 목록에서 밀려날 수 있다.
 * 특히 **활성 핀이 없는 장소는 늘 맨 뒤로 밀린다** — 상세로 들어오는 장소가 그럴 수 있다.
 *
 * 이 경로는 필터를 지정하지 않는다. 필터를 걸면 평균 혼잡도가 없는 장소가 응답에서 빠져
 * 활성 핀 없는 장소의 좌표를 영영 못 받는다(`api/place/list.ts`의 `NO_FILTER`).
 */
const NEARBY_SPAN_DEGREES = 0.003;

/**
 * 좌표를 모를 때 훑어 볼 범위(위경도 도 단위). 약 ±11km.
 *
 * 어디인지 모르면 기본 중심 주변을 훑는 수밖에 없다. 그 안에 없는 장소는 못 찾고, 개수
 * 상한에 밀려도 못 찾는다. 그래서 좌표를 아는 경로를 우선한다.
 */
const LOOKUP_SPAN_DEGREES = 0.1;

export interface ResolveOptions {
  /**
   * 기억해 둔 값을 쓰지 않고 목록을 다시 물어볼지.
   *
   * 받아 둔 값은 **그 순간의 활성 핀**이다. 방금 올라온 핀이나 그 뒤에 활성이 된 핀은 그 안에
   * 없어서, 장소 상세의 카드에는 있는데 지도에는 마커가 없는 상태가 된다. 상세 화면이 그런
   * 핀을 발견했을 때 이 옵션으로 한 번 더 묻는다.
   *
   * 서버가 같은 범위를 30초 캐시하므로(`PlacePinService.CACHE_TTL`) 곧바로 다시 물으면 같은
   * 값이 올 수 있다. 그래도 손해는 요청 한 번이고, 대개는 그 사이에 갱신된다.
   */
  refresh?: boolean;
}

/**
 * 장소 하나의 지도 정보(장소 좌표와 활성 핀 좌표)를 구한다.
 *
 * 핀 좌표를 주는 곳은 목록 API 하나뿐이라, 상세 화면에 들어올 때 그 API를 한 번 부른다.
 * 그때 **그 장소가 어디인지 알고 있으면 그 자리를 경계로 삼는다.** 추천 목록이 장소 좌표를
 * 함께 주므로 보통은 이 경로다.
 *
 * 좌표를 모르면 기준점(사용자 위치, 없으면 기본 중심) 주변을 넓게 훑는다. 이쪽은 확실하지
 * 않다 — 그 범위 밖이거나 개수 상한에 밀리면 찾지 못한다.
 *
 * 찾지 못해도 예외를 던지지 않는다. 좌표는 화면의 일부(지도)만 좌우하므로, 없으면 지도 자리만
 * 비우고 기본정보와 핀 목록은 그대로 보여주는 편이 낫다.
 */
export async function resolvePlaceMapData(
  placeId: number,
  placeCoordinate?: Coordinate | null,
  options?: ResolveOptions,
): Promise<PlaceMapData | null> {
  const remembered = recallPlaceMapData(placeId);
  if (remembered !== null && options?.refresh !== true) return remembered;

  /*
    다시 물을 때는 기억해 둔 좌표를 기준으로 삼는다. 부르는 쪽이 좌표를 모르더라도 한 번 받아
    둔 것이 있으면 그 자리를 좁게 물을 수 있다 — 넓게 훑는 경로보다 확실하다.
  */
  const around = placeCoordinate ?? remembered?.coordinate ?? null;
  const known = around != null && isPlottableCoordinate(around);
  const center = known ? around : DEFAULT_CENTER;
  const span = known ? NEARBY_SPAN_DEGREES : LOOKUP_SPAN_DEGREES;

  try {
    const { places } = await getPlaces({
      southWestLatitude: center.latitude - span,
      southWestLongitude: center.longitude - span,
      northEastLatitude: center.latitude + span,
      northEastLongitude: center.longitude + span,
    });
    rememberPlaceMapData(places);
  } catch (error) {
    /*
      목록을 못 받은 것뿐이다. 좌표를 알고 있으면 핀 없이 장소만이라도 지도에 찍는다.

      다만 **삼키기만 하면 실기기에서 원인을 찾을 수 없다** — 화면에는 "지도가 비었다"로만
      보이고 오류였다는 사실이 어디에도 남지 않는다. 실제로 `filter` 누락으로 400이 오던
      동안 이 catch가 그것을 가리고 있었다. 그래서 코드만 한 줄 남긴다.
    */
    log('목록 조회 실패', {
      placeId,
      코드: error instanceof ApiError ? error.code : '알수없음',
      대체: known ? '좌표만 사용' : '지도 없음',
    });
    return known ? { coordinate: around, activePins: [], averageCrowdLevel: null } : null;
  }

  const found = recallPlaceMapData(placeId);
  if (found !== null) return found;

  // 목록에 없더라도 좌표를 알고 있으면 지도는 그릴 수 있다. 핀만 비운다.
  return known ? { coordinate: around, activePins: [], averageCrowdLevel: null } : null;
}

/** 이름으로 찾은 등록 장소. 검색 확정이 놓친 장소를 상세로 안내하는 데 필요한 것만 담는다. */
export interface RegisteredPlaceMatch {
  placeId: number;
  coordinate: Coordinate;
}

/**
 * **이름이 정확히 같은 등록 장소**를 기준 좌표 주변(약 ±330m)에서 찾는다. 없으면 null.
 *
 * 검색 확정이 "미등록"이라고 답한 장소를 한 번 더 확인하는 데 쓴다. 한 가게가 카카오에 두
 * 항목으로 올라 있을 수 있다 — 핀은 한쪽 항목으로 등록됐는데 검색이 다른 항목을 고르면,
 * 확정은 `kakaoPlaceId`로만 찾으므로 핀이 있는 가게인데도 미등록으로 답한다(2026-08-06
 * 실기기 — 핀이 보이는 자리에서 "작성하러 가기"가 나왔다). 이름이 정확히 같고 곁에 있으면
 * 같은 가게로 보고 등록 장소의 상세로 안내한다.
 *
 * 목록 API의 한계는 `resolvePlaceMapData`와 같다(활성 핀 많은 순 최대 10건). 여기서 못
 * 찾았다고 미등록이라고 단정할 수는 없지만, 어차피 원래 미등록으로 안내하던 화면이므로
 * 잘못 안내하는 쪽이 넓어지지는 않는다. 실패도 같은 이유로 조용히 null로 답한다.
 */
export async function findRegisteredPlaceByName(
  name: string,
  around: Coordinate,
): Promise<RegisteredPlaceMatch | null> {
  if (!isPlottableCoordinate(around)) return null;

  try {
    const { places } = await getPlaces({
      southWestLatitude: around.latitude - NEARBY_SPAN_DEGREES,
      southWestLongitude: around.longitude - NEARBY_SPAN_DEGREES,
      northEastLatitude: around.latitude + NEARBY_SPAN_DEGREES,
      northEastLongitude: around.longitude + NEARBY_SPAN_DEGREES,
    });
    // 상세가 이 장소의 지도 정보를 곧 찾는다. 받은 김에 기억해 두면 그쪽은 다시 묻지 않는다.
    rememberPlaceMapData(places);

    const matches = places.filter((place) => place.name === name && isPlottableCoordinate(place));
    if (matches.length === 0) return null;

    // 같은 이름이 여럿이면(프랜차이즈) 기준 좌표에 가장 가까운 곳이 그 가게다.
    const best = matches.reduce((closest, candidate) =>
      distanceBetween(around, candidate) < distanceBetween(around, closest) ? candidate : closest,
    );

    return {
      placeId: best.placeId,
      coordinate: { latitude: best.latitude, longitude: best.longitude },
    };
  } catch (error) {
    log('이름으로 등록 장소 찾기 실패', {
      이름: name,
      코드: error instanceof ApiError ? error.code : '알수없음',
    });
    return null;
  }
}
