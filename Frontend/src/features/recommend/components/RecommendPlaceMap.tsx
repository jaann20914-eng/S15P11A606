import { useCallback, useRef } from 'react';
import { Text, View } from 'react-native';
import { KakaoMap, type KakaoMapHandle } from '@/components/home/KakaoMap';
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
    확대는 지도가 준비된 뒤에 건다. HTML에 심는 것은 중심 좌표뿐이라 레벨은 명령으로만 바꿀 수
    있고, 준비 전에 보내면 그대로 버려진다.
  */
  const focusPlace = useCallback(() => mapRef.current?.setLevel(PLACE_MAP_LEVEL), []);

  /*
    좌표는 장소 상세 응답에 없어 목록 API로 따로 구한다(`api/place/coordinates.ts`).
    못 구했을 때 지도를 그리면 엉뚱한 기본 좌표를 이 장소인 것처럼 보여주게 되므로 비워 둔다.
  */
  if (coordinate === null) {
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
