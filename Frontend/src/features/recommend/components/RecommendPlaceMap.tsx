import { Text, View } from 'react-native';
import { KakaoMap } from '@/components/home/KakaoMap';
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
      /*
        지도는 **이 좌표로 만들어진다.** 준비된 뒤에 `panTo`·`setLevel` 명령으로 옮기지
        않는다. 그 방식은 두 가지로 어긋났다.

        - 확대는 애니메이션이라, 시작 시점의 중심을 붙잡고 있다가 끝나면서 그 자리로 화면을
          정리한다. 그 사이에 보낸 중심 이동이 취소된다
        - 명령은 지도가 준비된 뒤에만 닿는다. 준비 전에 보낸 것은 그냥 사라진다

        좌표가 바뀌면 key가 달라져 지도를 새로 만든다. 화면 하나에 장소 하나뿐이라 이 비용은
        들지 않는 것이나 마찬가지고, 대신 "핀이 화면 밖에 있는" 상태가 생길 수 없다.
      */
      key={`${coordinate.latitude},${coordinate.longitude}`}
      center={coordinate}
      level={PLACE_MAP_LEVEL}
      places={[{ id: String(placeId), name, ...coordinate }]}
      // 핀 하나뿐이라 계열 색은 의미를 만들지 못한다. 목록 기본값과 같은 라임 계열로 둔다.
      filter="relaxed"
      selectedPlaceId={String(placeId)}
      myLocation={null}
      style={s.map}
    />
  );
}
