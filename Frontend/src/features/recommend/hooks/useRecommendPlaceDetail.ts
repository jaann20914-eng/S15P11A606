import { useEffect, useRef, useState } from 'react';
import { ApiError } from '@/api/client';
import { getPlaceDetail } from '@/api/place/detail';
import { resolvePlaceMapData, type PlaceMapData } from '@/api/place/coordinates';
import type { PlaceDetail } from '@/types/place';
import type { Coordinate } from '@/store/useMapStore';
import { withMinimumDuration } from '@/utils/promise';

export interface RecommendPlaceDetailState {
  detail: PlaceDetail | null;
  /** 지도에 찍을 것들(장소 좌표와 활성 핀 좌표). 구하지 못하면 null이고 지도 자리만 비운다. */
  mapData: PlaceMapData | null;
  loading: boolean;
  /** 실패 문구. 성공하면 null. */
  error: string | null;
}

/** 오류 코드별 안내. */
const messageByCode: Record<string, string> = {
  INVALID_PLACE_ID: '장소 정보가 올바르지 않아요.',
  UNAUTHORIZED: '로그인이 필요해요.',
  PLACE_NOT_FOUND: '장소를 찾을 수 없어요.',
  PLACE_DETAIL_FETCH_FAILED: '장소 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.',
};

/** 로딩 표시를 최소한 이만큼 유지한다. 이유는 `withMinimumDuration` 참고. */
const MIN_LOADING_MS = 400;

/**
 * 추천 상세가 보여줄 장소 한 곳.
 *
 * 기본정보 · 핀 카드 · 요일 통계는 `GET /api/v1/places/{placeId}` 하나로 온다. 좌표만 그
 * 응답에 없어 목록 API(`GET /api/v1/places`)로 따로 구한다 — 장소 좌표와 핀 좌표가 거기
 * 있다. 둘을 동시에 시작해 늦는 쪽만큼만 기다린다.
 *
 * 목록에서 장소 좌표를 넘겨받았으면(`placeCoordinate`) 그 자리 주변만 물어보므로 정확하다.
 * 없으면 기준점 주변을 넓게 훑는 예비 경로로 떨어진다.
 *
 * 좌표 실패는 오류로 다루지 않는다. 지도 없이도 나머지는 그대로 쓸모가 있다.
 */
export function useRecommendPlaceDetail(
  placeId: number | null,
  placeCoordinate?: Coordinate | null,
  /**
   * 값이 바뀌면 다시 받는다.
   *
   * 핀 상세에서 **내 핀을 고치거나 지우고 돌아왔을 때** 옛 내용이 그대로 남아 있으면 안 된다.
   * 화면이 초점을 되찾을 때 이 값을 올려 새로 받게 한다. 값이 그대로면 아무 일도 없다.
   */
  reloadToken = 0,
): RecommendPlaceDetailState {
  const [detail, setDetail] = useState<PlaceDetail | null>(null);
  const [mapData, setMapData] = useState<PlaceMapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** 이미 조회했는지. 화면이 다시 그려져도 두 번 부르지 않는다. */
  const requested = useRef(false);

  /*
    좌표는 조회를 다시 일으키지 않는다. 목록에서 넘겨받는 값이라 화면이 사는 동안 바뀌지
    않고, 의존성에 넣으면 객체가 매번 새로 만들어져 조회가 반복된다.
  */
  const coordinateRef = useRef(placeCoordinate);
  coordinateRef.current = placeCoordinate;

  /*
    다시 받을 차례인지. `reloadToken`이 바뀐 뒤 첫 실행에서만 참이 된다.

    조회를 한 번만 하도록 막는 `requested`와 따로 둔다 — 그 잠금을 여기서 풀어야 아래
    조회가 다시 돈다.
  */
  const lastTokenRef = useRef(reloadToken);

  if (lastTokenRef.current !== reloadToken) {
    lastTokenRef.current = reloadToken;
    requested.current = false;
  }

  useEffect(() => {
    if (placeId === null) {
      /*
        아직 이 카드 차례가 아니다(캐러셀에서 보이지 않는 자리). 조회하지 않고 조용히 둔다 —
        예전에는 이 자리가 "장소를 찾을 수 없어요"였는데, 그때는 주소로 바로 들어온 경우만
        placeId가 비었기 때문이다. 지금은 아직 열리지 않은 카드도 이리로 온다.
      */
      return;
    }
    if (requested.current) return;
    requested.current = true;

    const load = Promise.all([getPlaceDetail(placeId), resolvePlaceMapData(placeId, coordinateRef.current)]);

    withMinimumDuration(load, MIN_LOADING_MS)
      .then(async ([received, found]) => {
        /*
          카드에는 있는데 마커에 없는 핀이 보이면 좌표를 **한 번 다시** 받는다.

          좌표는 장소 목록 응답을 받아 둔 캐시에서 오는데, 그 값은 받은 순간의 활성 핀이다.
          방금 등록한 핀은 캐시에 없어 지도가 비었다 — 등록 직후 상세로 들어오면 카드는 1장,
          마커는 0개였다(2026-08-05). 한 번만 다시 묻고, 그래도 없으면 그대로 둔다(공개 전
          핀처럼 정말 마커가 없는 경우도 있다).
        */
        const markerIds = new Set((found?.activePins ?? []).map((pin) => pin.pinId));
        const missing = received.pins.some((pin) => !markerIds.has(pin.pinId));

        const mapResult = missing
          ? await resolvePlaceMapData(placeId, coordinateRef.current, { refresh: true })
          : found;

        setDetail(received);
        setMapData(mapResult);
        setLoading(false);
      })
      .catch((cause: unknown) => {
        setLoading(false);
        setError(
          cause instanceof ApiError
            ? (messageByCode[cause.code] ?? cause.message)
            : '장소 정보를 불러오지 못했어요',
        );
      });
  }, [placeId, reloadToken]);

  return { detail, mapData, loading, error };
}
