import { useEffect, useRef, useState } from 'react';
import { ApiError } from '@/api/client';
import { getPlaces } from '@/api/place/list';
import { isPlottableCoordinate, rememberPlaceMapData } from '@/api/place/coordinates';
import { getCrowdLevelByValue } from '@/constants/crowdLevels';
import type { CrowdLevelValue } from '@/constants/crowdLevels';
import type { MapBounds } from '@/store/useMapStore';
import type { PlaceListItem } from '@/types/place';

/**
 * 홈 지도에 찍을 주변 장소. `GET /api/v1/places`가 준 것을 화면이 쓰는 모양으로 정리한다.
 *
 * **목업 모드에서도 같은 길을 쓴다.** `api/place/list.ts`가 경계 한 곳에서 목업과 실서버를
 * 가르므로(`usesMock('place/list')`), 화면은 어느 쪽인지 알지 않는다. 예전에는 홈만 `@/data/mock`
 * 의 손으로 박은 배열을 직접 읽어서, 실서버로 돌려도 **가짜 장소 세 곳이 그대로 보이고 그 id로
 * 상세를 열어 404가 났다.**
 */
export interface NearbyPlace {
  /** 마커 id와 라우팅에 쓰는 문자열 식별자. 지도 마커가 문자열 id로 다룬다. */
  id: string;
  placeId: number;
  name: string;
  /** 카카오에서 실시간으로 채우므로 비어 있을 수 있다. */
  address: string;
  latitude: number;
  longitude: number;
  /**
   * 최근 1시간 유효 핀의 평균 혼잡 단계(1~4). **집계할 핀이 없으면 null이다.**
   *
   * 서버는 소수(2.4 등)로 주므로 가장 가까운 단계로 맞춘다. 혼잡도 필터가 이 값을 본다.
   */
  crowdLevel: CrowdLevelValue | null;
  /** 활성 핀 수. */
  pins: number;
  /** 작성자들의 공개 뷰 각도. 카드의 링이 이 값으로 채움 비율을 그린다. */
  angles: number[];
}

export interface NearbyPlacesState {
  places: NearbyPlace[];
  loading: boolean;
  /** 실패 문구. 성공하면 null. 이전 결과는 지우지 않는다. */
  error: string | null;
}

/**
 * 첫 조회에서 지도 경계를 이만큼(위경도 도)으로 넓힌다. 약 ±11km.
 *
 * 목록 API는 **지도에 보이는 범위**를 묻는 API다. 그런데 앱을 켠 자리에 장소가 없으면 첫 화면이
 * 텅 비고, 사용자에게는 그 자리에 없다는 것과 기능이 고장난 것이 구분되지 않는다. 그래서 처음
 * 한 번은 주변을 넓게 훑어 가까운 장소를 찾고, 홈이 그 핀들이 보이도록 지도를 맞춘다
 * (`fitPlacesOnReady`). 그 뒤로는 보이는 범위 그대로 묻는다.
 *
 * 서버는 어차피 **활성 핀이 많은 순 → 지도 중심에 가까운 순으로 최대 10건**만 주므로
 * (`PlacePinService.MAX_RESULT`) 넓게 물어도 응답이 커지지 않는다.
 */
const FIRST_LOOKUP_SPAN_DEGREES = 0.1;

/**
 * 같은 범위를 두 번 묻지 않으려고 경계를 반올림하는 자리수. 소수 넷째 자리는 약 11m다.
 *
 * 지도는 멈출 때마다(`idle`) 경계를 새 객체로 알려 주므로 값이 같아도 참조가 달라진다.
 * 문자열로 만들어 비교하면 실제로 움직였을 때만 다시 묻는다.
 */
const BOUNDS_PRECISION = 4;

/** 오류 코드별 안내. */
const messageByCode: Record<string, string> = {
  INVALID_MAP_RANGE: '지도 범위를 읽지 못했어요.',
  UNAUTHORIZED: '로그인이 필요해요.',
  INVALID_PLACE_FILTER: '혼잡도 필터를 다시 선택해 주세요.',
  PLACES_FETCH_FAILED: '주변 장소를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.',
};

function widen({ southWest, northEast }: MapBounds, span: number): MapBounds {
  const centerLatitude = (southWest.latitude + northEast.latitude) / 2;
  const centerLongitude = (southWest.longitude + northEast.longitude) / 2;

  return {
    // 이미 그보다 넓게 보고 있으면 좁히지 않는다. 보이는 것보다 적게 묻는 셈이 된다.
    southWest: {
      latitude: Math.min(southWest.latitude, centerLatitude - span),
      longitude: Math.min(southWest.longitude, centerLongitude - span),
    },
    northEast: {
      latitude: Math.max(northEast.latitude, centerLatitude + span),
      longitude: Math.max(northEast.longitude, centerLongitude + span),
    },
  };
}

function boundsKey({ southWest, northEast }: MapBounds): string {
  return [southWest.latitude, southWest.longitude, northEast.latitude, northEast.longitude]
    .map((value) => value.toFixed(BOUNDS_PRECISION))
    .join(',');
}

function toNearbyPlace(item: PlaceListItem): NearbyPlace {
  return {
    id: String(item.placeId),
    placeId: item.placeId,
    name: item.name,
    address: item.address,
    latitude: item.latitude,
    longitude: item.longitude,
    crowdLevel: item.averageCrowdLevel === null ? null : getCrowdLevelByValue(item.averageCrowdLevel).level,
    pins: item.activePins.length,
    angles: item.activePins.map((pin) => pin.viewAngle),
  };
}

/**
 * 지도에 보이는 범위의 장소를 따라간다.
 *
 * 지도가 멈출 때마다 다시 묻고, 같은 범위면 묻지 않는다. 응답의 좌표는 **상세 화면이 쓸 수 있도록
 * 함께 기억해 둔다**(`rememberPlaceMapData`) — 장소 상세와 핀 카드에는 좌표가 없어서, 지도에
 * 영상핀을 찍으려면 이 응답이 유일한 출처다.
 *
 * 실패해도 이전 결과를 지우지 않는다. 지도를 조금 옮긴 것 때문에 이미 보고 있던 핀이 사라지면
 * 사용자에게는 장소가 없어진 것으로 보인다.
 */
export function useNearbyPlaces(bounds: MapBounds | null): NearbyPlacesState {
  const [places, setPlaces] = useState<NearbyPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** 이미 물어본 범위. 같은 범위로 다시 오면 넘긴다. */
  const requestedKey = useRef<string | null>(null);
  /** 첫 조회를 끝냈는지. 처음 한 번만 넓게 훑는다. */
  const looked = useRef(false);
  /** 늦게 도착한 응답이 최신 결과를 덮지 않게 한다. */
  const sequence = useRef(0);

  useEffect(() => {
    if (bounds === null) return;

    const query = looked.current ? bounds : widen(bounds, FIRST_LOOKUP_SPAN_DEGREES);
    const key = boundsKey(query);
    if (requestedKey.current === key) return;

    requestedKey.current = key;
    looked.current = true;

    const current = sequence.current + 1;
    sequence.current = current;
    setLoading(true);

    /*
      혼잡도 필터를 서버에 넘기지 않는다.

      서버 필터는 **평균 혼잡도가 없는 장소를 응답에서 빼 버린다**(`matchesFilter`가 `null`을
      탈락시킨다). 그러면 활성 핀이 없는 장소의 좌표를 영영 받지 못해, 상세 화면이 그 장소를
      지도에 찍을 수 없다. 걸러 내는 일은 화면이 하고(`matchesCrowdFilter`) 받아 두는 것은 전부
      받아 둔다 — 어차피 최대 10건이다.
    */
    getPlaces({
      southWestLatitude: query.southWest.latitude,
      southWestLongitude: query.southWest.longitude,
      northEastLatitude: query.northEast.latitude,
      northEastLongitude: query.northEast.longitude,
    })
      .then((response) => {
        if (sequence.current !== current) return;

        // 좌표를 쓸 수 없는 장소는 지도에 찍을 수 없다. 목록에도 넣지 않아 카드와 마커를 맞춘다.
        const usable = response.places.filter(isPlottableCoordinate);
        rememberPlaceMapData(usable);

        setPlaces(usable.map(toNearbyPlace));
        setError(null);
        setLoading(false);
      })
      .catch((cause: unknown) => {
        if (sequence.current !== current) return;

        /*
          다음에 지도를 조금만 움직여도 다시 시도할 수 있도록 기록을 지운다. 남겨 두면 같은
          범위로 돌아왔을 때 실패한 채로 아무것도 하지 않는다.
        */
        requestedKey.current = null;
        setLoading(false);
        setError(
          cause instanceof ApiError
            ? (messageByCode[cause.code] ?? cause.message)
            : '주변 장소를 불러오지 못했어요',
        );
      });
  }, [bounds]);

  return { places, loading, error };
}
