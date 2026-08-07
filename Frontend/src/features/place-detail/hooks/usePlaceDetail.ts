import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ApiError } from '@/api/client';
import { getPlaceDetail } from '@/api/place/detail';
import { resolvePlaceMapData, type PlaceMapData } from '@/api/place/coordinates';
import type { Coordinate } from '@/store/useMapStore';
import type { PlaceDetail } from '@/types/place';
import { createDevLogger } from '@/utils/devLog';
import { withMinimumDuration } from '@/utils/promise';

const log = createDevLogger('place-detail-fetch');

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
  /**
   * 이 장소의 최근 1시간 평균 혼잡 단계(1~4). 모르면 null.
   *
   * **지도 마커 색이 이 값으로 갈린다.** 상세 응답에는 없어서 좌표와 같은 곳
   * (`resolvePlaceMapData`)에서 함께 받아 온다 — 사정은 `PlaceMapData`에 적어 두었다.
   */
  crowdLevel: number | null;
  /**
   * 이 장소의 좌표. 상세 응답에 없어 혼잡도와 같은 곳에서 함께 받아 온다. 모르면 null.
   *
   * 내 위치와의 거리를 재는 데 쓴다 — 핀이 없는 장소에서 작성으로 보낼지(50m 이내)가 이 값으로
   * 갈린다.
   */
  coordinate: Coordinate | null;
}

/**
 * 핀 카드에 촬영 좌표를 채운다.
 *
 * **장소 상세 응답에는 핀 좌표가 없다.** `PinCard`(`PinCardAssembler`)에 위도·경도 필드 자체가
 * 없어서, 실서버에서는 늘 null로 온다. 좌표를 주는 곳은 목록(`GET /api/v1/places`)의
 * `activePins[]` 하나뿐이다 — 홈이 지도를 그리며 이미 받아 둔 그 값을 여기서 붙인다.
 *
 * 이 좌표가 있어야 상세 화면이 핀 마커를 찍고, 게시물을 오르내릴 때 지도를 그 자리로
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
 * 핀을 찍을 수 없다. 장소 자체를 옮기는 일은 홈이 카드를 누른 시점에 이미 해 둔다.
 *
 * 좌표 조회는 실패해도 무시한다 — 지도 마커만 비고 기본정보와 핀 목록은 그대로 보여준다.
 */
export function usePlaceDetail(placeId: number | null): PlaceDetailState {
  const [detail, setDetail] = useState<PlaceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** 마커 색을 정하는 평균 혼잡 단계. 좌표와 함께 온다. */
  const [crowdLevel, setCrowdLevel] = useState<number | null>(null);
  const [coordinate, setCoordinate] = useState<Coordinate | null>(null);

  /**
   * 마지막으로 화면에 그려 둔 장소. **다시 물을 때 조용히 할지가 이 값으로 갈린다.**
   *
   * 같은 장소로 다시 포커스되면(위 화면에서 돌아옴) 보여주던 것을 그대로 두고 조용히 갱신하고,
   * 다른 장소로 갈리면 앞 장소의 값을 버리고 로딩부터 시작한다.
   */
  const shown = useRef<number | null>(null);
  /** 늦게 도착한 응답이 최신 결과를 덮지 않게 한다. */
  const sequence = useRef(0);

  /*
    **화면이 맨 위로 돌아올 때마다 다시 묻는다**(포커스 기반).

    예전에는 장소당 한 번만 조회했다. 그런데 이 화면 위에서 핀을 지우거나(게시물 상세) 새로
    올릴 수 있어서, 돌아와도 지운 게시물이 카드에 그대로 남았다 — 조회가 화면 진입 시점의
    캐시로 굳어 있던 셈이다. 이제 돌아올 때마다 상세와 지도 정보를 다시 받는다. 이미 보여주는
    중이면 조용히 갱신하고(로딩 표시 없음), 실패해도 보여주던 것을 지우지 않는다.

    지도 정보도 다시 받아야 한다(`refresh`) — `resolvePlaceMapData`는 한 번 받은 것을 기억해
    두므로, 그대로 두면 지운 핀의 마커가 지도에 남는다.
  */
  useFocusEffect(
    useCallback(() => {
      if (placeId === null) {
        setLoading(false);
        setError('장소를 찾을 수 없어요.');
        return;
      }

      const silent = shown.current === placeId;
      if (!silent) {
        /*
          다른 장소로 갈렸으면 앞의 값을 버린다. 남겨 두면 새 장소를 기다리는 동안 앞 장소의
          이름과 카드가 그대로 보여, 어느 장소를 보고 있는지 알 수 없다.
        */
        setDetail(null);
        setCrowdLevel(null);
        setCoordinate(null);
        setError(null);
        setLoading(true);
      }

      const current = sequence.current + 1;
      sequence.current = current;

      /*
        둘을 함께 기다린다. 좌표는 홈이 이미 받아 둔 것을 꺼내 쓰는 것이 보통이라(그 경우 즉시
        돌아온다) 상세 조회보다 늦어지지 않는다. 로딩을 보여주는 첫 조회만 최소 시간을 지킨다.
      */
      Promise.all([
        silent ? getPlaceDetail(placeId) : withMinimumDuration(getPlaceDetail(placeId), MIN_LOADING_MS),
        resolvePlaceMapData(placeId, null, { refresh: silent }),
      ])
        .then(([received, mapData]) => {
          // 늦게 도착한 응답이 다른 장소의 화면을 덮지 않게 한다.
          if (sequence.current !== current) return;

          /*
            **두 API가 같은 장소를 두고 핀 개수를 다르게 말하는지 본다.**

            홈 카드의 `핀 N개`와 마커는 목록(`GET /places`)의 `activePins`에서 나오고, 이 화면의
            카드는 상세(`GET /places/{id}`)의 `pins`에서 나온다. 둘이 어긋나면 **홈에는 핀이
            있는데 들어오면 비어 있는** 화면이 된다 — 사용자에게는 라우팅이 잘못된 것으로 보인다.

            실제로 그런 적이 있다(2026-08-07). 목록 쿼리에만 `deletedAt IS NULL`이 빠져 있어
            **지운 핀이 홈에서만 계속 세어졌고**, 원인을 좁히는 데 여러 번을 썼다. 어긋나는 순간
            로그 한 줄이 그것을 말해 주면 다음에는 한 번에 끝난다.

            프론트 쪽 사정으로도 어긋날 수 있다 — 좌표 저장소는 모듈 캐시라(`resolvePlaceMapData`)
            조용한 갱신이 아니면 홈이 받아 둔 값을 그대로 쓴다. 그래서 어느 쪽인지 단정하지 않고
            두 값만 남긴다.
          */
          const listed = mapData?.activePins ?? null;
          if (listed !== null && listed.length !== received.pins.length) {
            /*
              **어긋난 핀의 id까지 남긴다.** 개수만으로는 백엔드에서 확인할 것이 없다. id가 있으면
              `SELECT id, deleted_at, video_status FROM pins WHERE id IN (...)` 한 번으로 그 핀들이
              왜 한쪽에만 있는지 바로 드러난다(2026-08-07: 목록에만 있던 핀은 전부 지운 핀이었다).
            */
            const inDetail = new Set(received.pins.map((pin) => pin.pinId));
            const listOnly = listed.filter((pin) => !inDetail.has(pin.pinId)).map((pin) => pin.pinId);

            log('핀 개수 불일치', {
              placeId,
              목록: listed.length,
              상세: received.pins.length,
              목록에만있는핀: listOnly,
              갱신: silent ? '목록을 다시 물었음' : '홈이 받아 둔 값',
              사정: '서버 두 응답이 다르거나, 목록 값이 오래된 것이다',
            });
          }

          const merged = withPinCoordinates(received, mapData);
          shown.current = placeId;
          setDetail(merged);
          setCrowdLevel(mapData?.averageCrowdLevel ?? null);
          setCoordinate(mapData?.coordinate ?? null);
          setError(null);
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
            .then((fresh) => {
              if (sequence.current !== current) return;

              setDetail((now) => (now === null ? now : withPinCoordinates(now, fresh)));
              // 처음에 못 받았으면 이 응답으로 채운다. 이미 아는 값을 null로 되돌리지는 않는다.
              if (fresh?.averageCrowdLevel != null) setCrowdLevel(fresh.averageCrowdLevel);
              if (fresh?.coordinate != null) setCoordinate((now) => now ?? fresh.coordinate);
            })
            .catch(() => undefined);
        })
        .catch((cause: unknown) => {
          if (sequence.current !== current) return;

          // 조용한 갱신이 실패한 것으로 보여주던 화면을 지우지 않는다. 다음 복귀 때 다시 묻는다.
          if (silent) return;

          setLoading(false);
          setError(
            cause instanceof ApiError
              ? (messageByCode[cause.code] ?? cause.message)
              : '장소 정보를 불러오지 못했어요',
          );
        });
    }, [placeId]),
  );

  return { detail, loading, error, crowdLevel, coordinate };
}
