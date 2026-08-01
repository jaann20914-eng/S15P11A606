import { useCallback, useRef } from 'react';
import { Text, View } from 'react-native';
import { KakaoMap, type KakaoMapHandle } from '@/components/home/KakaoMap';
import { isPlottableCoordinate } from '@/api/place/coordinates';
import type { Coordinate } from '@/store/useMapStore';
import { recommendStyles as s } from '../styles';

export interface RecommendPlaceMapProps {
  placeId: number;
  name: string;
  /** 구하지 못했으면 null. 그때는 지도 대신 안내를 보여준다. */
  coordinate: Coordinate | null;
}

/** 이 장소만 확대해 보여줄 지도 레벨. 홈 기본값(5)은 동네 전체가 들어와 한 곳을 짚어 주지 못한다. */
const PLACE_MAP_LEVEL = 3;

/**
 * 추천 상세 위쪽의 지도.
 *
 * 홈과 달리 **읽기 전용**이다. 이 장소의 핀 하나만 찍고 내 위치도, 검색도 두지 않는다.
 * 여기서 지도가 하는 일은 "그래서 여기가 어디냐"에 답하는 것뿐이라, 조작 수단을 두면
 * 사용자가 지도를 탐색하다 화면의 목적(장소 하나 살펴보기)에서 벗어난다.
 *
 * `usePlaceSearch`를 켜지 않으므로 검색용 SDK 번들도 받지 않는다 — 첫 렌더가 그만큼 빠르다.
 */
export function RecommendPlaceMap({ placeId, name, coordinate }: RecommendPlaceMapProps) {
  const mapRef = useRef<KakaoMapHandle>(null);

  /*
    지도가 준비되면 확대 레벨을 맞추고 중심을 다시 한 번 이 장소로 보낸다.

    최초 중심은 지도 HTML에 심어 두지만, 그것은 컴포넌트가 처음 그려질 때의 값으로 굳는다.
    중심을 명령으로 한 번 더 확정해 두면 그 사이 좌표가 늦게 도착했거나 지도가 다른 자리에서
    시작한 경우에도 결과가 같다. 이미 그 자리면 지도 쪽에서 무시하므로 화면이 흔들리지 않는다.

    준비 전에 보낸 명령은 그대로 버려지므로 반드시 `onReady` 이후여야 한다.
  */
  const focusPlace = useCallback(() => {
    mapRef.current?.setLevel(PLACE_MAP_LEVEL);
    if (coordinate !== null) mapRef.current?.panTo(coordinate, { animate: false });
  }, [coordinate]);

  /*
    좌표는 장소 상세 응답에 없어 목록 API로 따로 구한다(`api/place/coordinates.ts`).

    못 구했으면 지도를 아예 그리지 않는다. 쓸 수 없는 좌표로 지도를 만들면 카카오가 중심을
    잡지 못해 **제주 앞바다**를 보여주는데, 화면에는 그냥 "엉뚱한 곳에 가 있는 지도"로만
    보여서 값이 없다는 사실이 드러나지 않는다.
  */
  if (coordinate === null || !isPlottableCoordinate(coordinate)) {
    return (
      <View style={[s.map, s.mapFallback]}>
        <Text style={s.stateText}>이 장소의 위치 정보를 아직 받지 못했어요</Text>
      </View>
    );
  }

  return (
    <KakaoMap
      ref={mapRef}
      center={coordinate}
      places={[{ id: String(placeId), name, ...coordinate }]}
      // 핀 하나뿐이라 계열 색은 의미를 만들지 못한다. 목록 기본값과 같은 라임 계열로 둔다.
      filter="relaxed"
      selectedPlaceId={String(placeId)}
      myLocation={null}
      onReady={focusPlace}
      style={s.map}
    />
  );
}
