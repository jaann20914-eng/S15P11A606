import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ApiError } from '@/api/client';
import { getPlaces } from '@/api/place/list';
import { getPlaceDetail } from '@/api/place/detail';
import { isPlottableCoordinate, rememberPlaceMapData } from '@/api/place/coordinates';
import { getCrowdLevelByValue } from '@/constants/crowdLevels';
import type { CrowdLevelValue } from '@/constants/crowdLevels';
import type { MapBounds } from '@/store/useMapStore';
import type { PlaceListItem } from '@/types/place';

/**
 * 홈 지도에 찍을 장소. **지도에 보이는 범위**(`GET /api/v1/places`)를 화면이 쓰는 모양으로 정리한다.
 *
 * **`pin-create`의 `useNearbyPlaces`와 다른 것이다.** 그쪽은 등록 화면이 쓰는
 * `GET /api/v1/places/nearby` — 내가 서 있는 자리 반경 50m의 **카카오 장소 후보**이고, 값도 등록
 * 요청에 그대로 실을 모양(`kakaoPlaceId`·`placeName`)이다. 이 훅은 우리 DB에 있는 장소와 활성
 * 핀을 지도 경계로 받는다. 이름을 `usePlacesInView`로 둔 이유가 그것이다 — 둘 다 "주변"이라
 * 부르면 어느 API를 부르는지 코드에서 구분되지 않는다.
 *
 * **목업 모드에서도 같은 길을 쓴다.** `api/place/list.ts`가 경계 한 곳에서 목업과 실서버를
 * 가르므로(`usesMock('place/list')`), 화면은 어느 쪽인지 알지 않는다. 예전에는 홈만 `@/data/mock`
 * 의 손으로 박은 배열을 직접 읽어서, 실서버로 돌려도 **가짜 장소 세 곳이 그대로 보이고 그 id로
 * 상세를 열어 404가 났다.**
 */
export interface PlaceInView {
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

export interface PlacesInViewState {
  places: PlaceInView[];
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

/* ------------------------------------------------------------------ *
 * [임시·시연용] 홈 카드의 핀 개수를 장소 상세와 맞춘다
 *
 * ▶ 켜고 끄기: 아래 두 줄 중 **하나만 살려 둔다.**
 *
 * 왜 필요한가
 *   목록(`GET /places`)과 상세(`GET /places/{id}`)가 핀을 세는 조건이 서버에서 한 줄 다르다.
 *   목록 쿼리(`PinRepository.findValidPins`)에만 `deletedAt IS NULL`이 빠져 있어 **지운 핀이
 *   홈에서만 계속 세어진다** — 홈은 5개, 들어가면 3개가 된다(2026-08-07 실기기).
 *
 *   고칠 곳은 백엔드 한 줄인데 담당자가 바빠 당장 어렵다. 시연에서 두 숫자가 다르면 설명이
 *   꼬이므로, **그동안만** 프론트가 상세를 한 번 더 물어 맞춘다.
 *
 * 왜 이 방향인가 (반대는 불가능하다)
 *   상세를 홈에 맞추는 길(3 → 5)은 없다. 서버가 지운 핀을 **아예 보내지 않아** 화면에 세울
 *   카드가 없고, 목록의 `activePins`에는 `pinId·좌표·각도`뿐이라 카드를 만들 수도 없다.
 *   만료로 거르는 길도 없다 — 그 배열에 시각 필드가 없고, 애초에 두 API의 만료 창은
 *   `ACTIVE_WINDOW = 1시간`으로 이미 같다. 차이는 오직 삭제 여부다.
 *
 * 비용
 *   핀이 있는 장소마다 상세 조회가 한 번 더 나가고, 홈 목록이 그만큼 늦게 뜬다. 핀이 없는
 *   장소는 묻지 않는다. 한 곳이 실패하면 그 장소만 목록 값을 그대로 쓴다.
 *
 * 지울 때
 *   백엔드가 고쳐지면 **이 블록과 아래 `load` 안의 `[임시]` 한 줄만** 지우면 된다.
 * ------------------------------------------------------------------ */

/** [임시·시연용] 아래 두 줄 중 하나만 살려 둔다. */
const MATCH_DETAIL_PIN_COUNT = true; // ← 시연용: 홈 개수 = 상세 개수 (상세를 한 번 더 물어본다)
// const MATCH_DETAIL_PIN_COUNT = false; // ← 원래대로: 서버 목록 값을 그대로 쓴다

/**
 * [임시·시연용] 핀이 있는 장소만 상세를 물어 **진짜 개수와 각도**로 바꿔 준다.
 *
 * 개수만이 아니라 각도 링도 함께 고친다 — 개수만 맞추면 카드에 링이 다섯 개인데 숫자는 3이 된다.
 *
 * 실패는 삼킨다. 시연 중에 한 곳이 안 됐다고 목록 전체가 비면 그쪽이 더 곤란하다.
 */
async function matchDetailPinCounts(places: PlaceInView[]): Promise<PlaceInView[]> {
  const targets = places.filter((place) => place.pins > 0);
  if (targets.length === 0) return places;

  const fixed = new Map<number, Pick<PlaceInView, 'pins' | 'angles'>>();

  await Promise.all(
    targets.map(async (place) => {
      try {
        const detail = await getPlaceDetail(place.placeId);
        fixed.set(place.placeId, {
          pins: detail.pins.length,
          angles: detail.pins.map((pin) => pin.viewAngle),
        });
      } catch {
        /* 못 물어본 장소는 목록 값을 그대로 둔다. */
      }
    }),
  );

  return places.map((place) => {
    const correction = fixed.get(place.placeId);
    return correction === undefined ? place : { ...place, ...correction };
  });
}

function toPlaceInView(item: PlaceListItem): PlaceInView {
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
 * 핀을 찍으려면 이 응답이 유일한 출처다.
 *
 * 실패해도 이전 결과를 지우지 않는다. 지도를 조금 옮긴 것 때문에 이미 보고 있던 핀이 사라지면
 * 사용자에게는 장소가 없어진 것으로 보인다.
 */
export function usePlacesInView(bounds: MapBounds | null): PlacesInViewState {
  const [places, setPlaces] = useState<PlaceInView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** 이미 물어본 범위. 같은 범위로 다시 오면 넘긴다. */
  const requestedKey = useRef<string | null>(null);
  /** 첫 조회를 끝냈는지. 처음 한 번만 넓게 훑는다. */
  const looked = useRef(false);
  /** 늦게 도착한 응답이 최신 결과를 덮지 않게 한다. */
  const sequence = useRef(0);

  /**
   * 범위 하나를 실제로 묻는다.
   *
   * `silent`면 로딩 표시를 켜지 않는다 — 이미 보여주는 목록을 조용히 갱신하는 길이라,
   * 화면을 오갈 때마다 카드 자리가 스피너로 바뀌면 그쪽이 더 고장으로 보인다.
   */
  const load = useCallback((query: MapBounds, silent: boolean) => {
    const current = sequence.current + 1;
    sequence.current = current;
    if (!silent) setLoading(true);

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
      .then(async (response) => {
        if (sequence.current !== current) return;

        // 좌표를 쓸 수 없는 장소는 지도에 찍을 수 없다. 목록에도 넣지 않아 카드와 마커를 맞춘다.
        const usable = response.places.filter(isPlottableCoordinate);
        rememberPlaceMapData(usable);

        const inView = usable.map(toPlaceInView);
        // [임시·시연용] 이 한 줄과 위 블록만 지우면 원래대로 돌아온다.
        const shown = MATCH_DETAIL_PIN_COUNT ? await matchDetailPinCounts(inView) : inView;

        // 기다리는 동안 다른 범위를 물었을 수 있다. 그 결과를 덮지 않는다.
        if (sequence.current !== current) return;

        setPlaces(shown);
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
  }, []);

  useEffect(() => {
    if (bounds === null) return;

    const query = looked.current ? bounds : widen(bounds, FIRST_LOOKUP_SPAN_DEGREES);
    const key = boundsKey(query);
    if (requestedKey.current === key) return;

    requestedKey.current = key;
    looked.current = true;
    load(query, false);
  }, [bounds, load]);

  /*
    **홈이 다시 맨 위로 돌아오면 같은 범위라도 다시 묻는다.**

    이 훅은 같은 범위를 두 번 묻지 않는데, 그 사이 다른 화면에서 핀을 지우거나 올렸을 수 있다.
    그대로 두면 삭제한 게시물이 카드에 남고 방금 올린 핀이 보이지 않는다 — 지도는 그대로라
    저절로 갱신될 계기도 없다. 조용히 다시 받아(silent) 화면이 튀지 않게 갱신한다.

    첫 포커스는 넘긴다 — 위 효과가 첫 조회(넓게 훑기)를 맡고 있어 겹쳐 묻게 된다.
  */
  const boundsRef = useRef(bounds);
  boundsRef.current = bounds;
  const focusedOnce = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!focusedOnce.current) {
        focusedOnce.current = true;
        return;
      }

      const current = boundsRef.current;
      if (current === null) return;
      load(current, true);
    }, [load]),
  );

  return { places, loading, error };
}
