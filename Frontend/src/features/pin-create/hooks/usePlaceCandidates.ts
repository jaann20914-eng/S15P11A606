import { useEffect, useRef, useState } from 'react';
import { getPlaces } from '@/api/place/list';
import { MAX_PLACE_DISTANCE_METERS } from '@/types/pinCreate';
import type { InternalDraftPlace } from '@/types/pinCreate';
import type { Coordinate } from '@/store/useMapStore';
import { distanceBetween } from '@/utils/location';

export interface PlaceCandidate extends InternalDraftPlace {
  /** 기준 좌표에서 떨어진 거리(m). 가까운 순으로 보여준다. */
  distanceMeters: number;
}

export interface PlaceCandidates {
  places: PlaceCandidate[];
  loading: boolean;
  /** 실패 문구. 성공하면 null. */
  error: string | null;
}

/** 위도 1도의 거리(m). 경도는 위도에 따라 줄어들어 따로 계산한다. */
const METERS_PER_LATITUDE_DEGREE = 111_320;

/**
 * 수정에서 고를 수 있는 장소 후보.
 *
 * 등록과 다른 곳에서 가져온다. 수정 API는 **우리 DB의 내부 식별자만** 받는데 카카오 검색은
 * 그 값을 주지 않는다. 그래서 장소 목록(`GET /api/v1/places`)을 쓴다 — 이쪽이 내부 장소를
 * 주고, 마침 지도 경계로 묻는 API라 "이 근처"라는 조건과도 맞는다.
 *
 * 범위는 기준 좌표에서 50m다. 서버가 최종 장소와 촬영 좌표의 거리를 그만큼으로 제한하므로,
 * 더 넓게 보여줘 봐야 고르는 순간 거절된다.
 *
 * 서버가 한 번에 최대 10곳까지 준다(지도용 상한). 50m 안이면 대개 다 들어오지만, 원하는
 * 장소가 없을 수도 있다.
 */
export function usePlaceCandidates(center: Coordinate | null): PlaceCandidates {
  const [places, setPlaces] = useState<PlaceCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** 이미 조회했는지. 화면이 다시 그려져도 두 번 부르지 않는다. */
  const requested = useRef(false);

  useEffect(() => {
    if (center === null || requested.current) return;
    requested.current = true;
    setLoading(true);

    /*
      [임시 해제] 후보 범위를 50m(MAX_PLACE_DISTANCE_METERS)로 좁히던 제한.
      서버 검증이 임시로 넓게 풀려 있는 동안 멀리 있는 장소도 고를 수 있게 1km로
      넓혀 둔다. 되돌릴 때는 아래 상수를 MAX_PLACE_DISTANCE_METERS로 바꾸고,
      아래쪽의 거리 필터 주석을 푼다.
    */
    const candidateRadiusMeters = 1000; // 원래 값: MAX_PLACE_DISTANCE_METERS

    // 위경도 폭은 위도에 따라 달라진다. 경도 쪽이 더 넓게 벌어져야 같은 거리가 된다.
    const latitudeSpan = candidateRadiusMeters / METERS_PER_LATITUDE_DEGREE;
    const longitudeSpan = latitudeSpan / Math.max(Math.cos((center.latitude * Math.PI) / 180), 0.01);

    getPlaces({
      southWestLatitude: center.latitude - latitudeSpan,
      southWestLongitude: center.longitude - longitudeSpan,
      northEastLatitude: center.latitude + latitudeSpan,
      northEastLongitude: center.longitude + longitudeSpan,
    })
      .then((response) => {
        const found = response.places
          .map((place) => ({
            source: 'internal' as const,
            placeId: place.placeId,
            name: place.name,
            latitude: place.latitude,
            longitude: place.longitude,
            distanceMeters: Math.round(distanceBetween(center, place)),
          }))
          // [임시 해제] 경계 상자는 네모라 모서리 쪽이 범위를 넘는다. 실제 거리로 한 번 더 거른다.
          // .filter((place) => place.distanceMeters <= MAX_PLACE_DISTANCE_METERS)
          .sort((a, b) => a.distanceMeters - b.distanceMeters);

        setPlaces(found);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
        setError('주변 장소를 불러오지 못했어요.');
      });
  }, [center]);

  return { places, loading, error };
}
