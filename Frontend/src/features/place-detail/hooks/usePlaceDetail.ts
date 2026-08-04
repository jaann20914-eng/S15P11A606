import { useEffect, useRef, useState } from 'react';
import { ApiError } from '@/api/client';
import { getPlaceDetail } from '@/api/place/detail';
import { resolvePlaceMapData, type PlaceMapData } from '@/api/place/coordinates';
import type { PlaceDetail } from '@/types/place';
import { withMinimumDuration } from '@/utils/promise';

/** 오류 코드별 안내. */
const messageByCode: Record<string, string> = {
  INVALID_PLACE_ID: '장소 정보가 올바르지 않아요.',
  UNAUTHORIZED: '로그인이 필요해요.',
  PLACE_NOT_FOUND: '장소를 찾을 수 없어요.',
  PLACE_DETAIL_FETCH_FAILED: '장소 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.',
};

/** 로딩 표시를 최소한 이만큼 유지한다. 이유는 `withMinimumDuration` 참고. */
const MIN_LOADING_MS = 400;

export interface PlaceDetailState {
  detail: PlaceDetail | null;
  loading: boolean;
  /** 실패 문구. 성공하면 null. */
  error: string | null;
}

/**
 * 핀 카드에 촬영 좌표를 채운다.
 *
 * **장소 상세 응답에는 핀 좌표가 없다.** `PinCard`(`PinCardAssembler`)에 위도·경도 필드 자체가
 * 없어서, 실서버에서는 늘 null로 온다. 좌표를 주는 곳은 목록(`GET /api/v1/places`)의
 * `activePins[]` 하나뿐이다 — 홈이 지도를 그리며 이미 받아 둔 그 값을 여기서 붙인다.
 *
 * 이 좌표가 있어야 상세 화면이 영상핀 마커를 찍고, 게시물을 오르내릴 때 지도를 그 자리로
 * 옮길 수 있다. 없는 핀은 null로 남고 마커도 찍히지 않는다 — 화면이 깨지지 않아야 한다.
 *
 * 목업은 이미 좌표를 채워 주므로 그 값을 덮지 않는다.
 */
function withPinCoordinates(detail: PlaceDetail, mapData: PlaceMapData | null): PlaceDetail {
  if (mapData === null || mapData.activePins.length === 0) return detail;

  const byPinId = new Map(mapData.activePins.map((pin) => [pin.pinId, pin]));

  return {
    ...detail,
    pins: detail.pins.map((pin) => {
      if (pin.latitude !== null && pin.longitude !== null) return pin;

      const located = byPinId.get(pin.pinId);
      if (located === undefined) return pin;

      return { ...pin, latitude: located.latitude, longitude: located.longitude };
    }),
  };
}

/**
 * 홈 지도 위에 겹치는 장소 화면이 보여줄 장소 한 곳.
 *
 * 기본정보 · 활성 핀 카드 · 요일별 혼잡 통계가 `GET /api/v1/places/{placeId}` 하나로 온다.
 *
 * **핀 좌표만 목록 API에서 따로 받아 붙인다**(`withPinCoordinates`). 이 화면은 자기 지도를
 * 만들지 않고 아래 깔린 홈 지도에 마커를 부탁하는데, 상세 응답에 좌표가 없어 그것만으로는
 * 영상핀을 찍을 수 없다. 장소 자체를 옮기는 일은 홈이 카드를 누른 시점에 이미 해 둔다.
 *
 * 좌표 조회는 실패해도 무시한다 — 지도 마커만 비고 기본정보와 핀 목록은 그대로 보여준다.
 */
export function usePlaceDetail(placeId: number | null): PlaceDetailState {
  const [detail, setDetail] = useState<PlaceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** 이미 조회했는지. 화면이 다시 그려져도 두 번 부르지 않는다. */
  const requested = useRef(false);

  useEffect(() => {
    if (placeId === null) {
      setLoading(false);
      setError('장소를 찾을 수 없어요.');
      return;
    }
    if (requested.current) return;
    requested.current = true;

    /*
      둘을 함께 기다린다. 좌표는 홈이 이미 받아 둔 것을 꺼내 쓰는 것이 보통이라(그 경우 즉시
      돌아온다) 상세 조회보다 늦어지지 않는다.
    */
    Promise.all([withMinimumDuration(getPlaceDetail(placeId), MIN_LOADING_MS), resolvePlaceMapData(placeId)])
      .then(([received, mapData]) => {
        const merged = withPinCoordinates(received, mapData);
        setDetail(merged);
        setLoading(false);

        /*
          좌표를 못 붙인 핀이 남았으면 목록을 한 번 더 물어본다.

          받아 둔 좌표는 홈이 지도를 그릴 때의 활성 핀이라, **그 뒤에 올라온 핀은 그 안에 없다.**
          그러면 카드는 있는데 지도에 마커가 없어 "핀이 다 보이지 않는다"가 된다. 다시 물어
          붙일 수 있으면 붙인다.

          실패하거나 그래도 없으면 그대로 둔다 — 이미 화면은 그려져 있고, 마커 하나가 비는 것과
          화면이 비는 것은 다르다.
        */
        if (!merged.pins.some((pin) => pin.latitude === null)) return;

        resolvePlaceMapData(placeId, mapData?.coordinate ?? null, { refresh: true })
          .then((fresh) =>
            setDetail((current) => (current === null ? current : withPinCoordinates(current, fresh))),
          )
          .catch(() => undefined);
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

  return { detail, loading, error };
}
