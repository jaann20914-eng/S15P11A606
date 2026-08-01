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
 * 응답에 없어 목록 API(`GET /api/v1/places`)로 따로 구한다 — 장소 좌표와 영상핀 좌표가 거기
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

  useEffect(() => {
    if (placeId === null) {
      setLoading(false);
      setError('장소를 찾을 수 없어요.');
      return;
    }
    if (requested.current) return;
    requested.current = true;

    const load = Promise.all([
      getPlaceDetail(placeId),
      resolvePlaceMapData(placeId, coordinateRef.current),
    ]);

    withMinimumDuration(load, MIN_LOADING_MS)
      .then(([received, found]) => {
        setDetail(received);
        setMapData(found);
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
  }, [placeId]);

  return { detail, mapData, loading, error };
}
