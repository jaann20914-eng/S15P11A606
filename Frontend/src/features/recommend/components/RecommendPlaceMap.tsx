import { useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { KakaoMap, type KakaoMapHandle } from '@/components/home/KakaoMap';
import type { PlaceMapData } from '@/api/place/coordinates';
import { recommendStyles as s } from '../styles';

export interface RecommendPlaceMapProps {
  name: string;
  /** 구하지 못했으면 null. 그때는 지도 대신 안내를 보여준다. */
  mapData: PlaceMapData | null;
}

/** 이 장소만 확대해 보여줄 지도 레벨. 홈 기본값(5)은 동네 전체가 들어와 한 곳을 짚어 주지 못한다. */
const PLACE_MAP_LEVEL = 3;

/**
 * 추천 상세 위쪽의 지도.
 *
 * 이 장소에 달린 **영상핀들을 각자 자기 좌표에 찍는다.** 장소는 건물 하나가 아니라 거리나
 * 공원인 경우가 많아, 점 하나로는 "어디쯤에서 찍힌 영상인지"를 알려주지 못한다. 핀을 누르면
 * 그 영상핀으로 간다.
 *
 * 홈과 달리 **읽기 전용**이다. 내 위치도, 검색도 두지 않는다. 여기서 지도가 하는 일은
 * "그래서 여기가 어디냐"에 답하는 것뿐이라, 조작 수단을 두면 사용자가 지도를 탐색하다 화면의
 * 목적(장소 하나 살펴보기)에서 벗어난다.
 *
 * `usePlaceSearch`를 켜지 않으므로 검색용 SDK 번들도 받지 않는다 — 첫 렌더가 그만큼 빠르다.
 */
export function RecommendPlaceMap({ name, mapData }: RecommendPlaceMapProps) {
  const mapRef = useRef<KakaoMapHandle>(null);
  const [ready, setReady] = useState(false);
  /** 지도 칸의 실제 크기. 값이 바뀔 때마다 지도에 알려 준다. */
  const [boxSize, setBoxSize] = useState({ width: 0, height: 0 });

  const coordinate = mapData?.coordinate ?? null;
  const latitude = coordinate?.latitude ?? null;
  const longitude = coordinate?.longitude ?? null;

  /*
    핀이 하나도 없으면 장소 자리에 하나 찍는다. 빈 지도는 주소만 있는 것과 다를 바가 없다.
  */
  const markers = useMemo(() => {
    if (mapData === null) return [];
    if (mapData.activePins.length === 0) {
      return [{ id: 'place', name, ...mapData.coordinate }];
    }

    return mapData.activePins.map((pin) => ({
      id: pin.pinId,
      name: `${name} 영상핀`,
      latitude: pin.latitude,
      longitude: pin.longitude,
    }));
  }, [mapData, name]);

  /*
    지도 칸의 크기가 정해지거나 바뀌면 다시 맞춘다.

    지도는 만들어지는 순간의 컨테이너 크기를 기준으로 중심을 잡는다. 그런데 WebView가 최종
    크기를 갖는 시점은 그보다 늦을 수 있고(스크롤 안에 놓인 경우가 그렇다), 그러면 지도는
    **자기가 더 작거나 크다고 믿은 채** 중심을 계산한다. 화면에는 핀이 한참 치우쳐 있거나
    아예 밖으로 나가 보인다.

    `relayout`으로 크기를 다시 읽히고, 곧바로 중심을 이 장소로 확정한다. 확대는 지도를 만들
    때 이미 넣었으므로(`level`) 여기서 건드리지 않는다 — 확대 애니메이션은 시작 시점의 중심을
    붙잡고 있다가 끝나면서 방금 옮긴 중심을 되돌린다.
  */
  useEffect(() => {
    if (!ready || latitude === null || longitude === null) return;
    if (boxSize.width === 0 || boxSize.height === 0) return;

    mapRef.current?.relayout();
    mapRef.current?.panTo({ latitude, longitude }, { animate: false });
  }, [boxSize, latitude, longitude, ready]);

  /*
    좌표는 장소 상세 응답에 없어 목록 API로 따로 구한다(`api/place/coordinates.ts`).

    못 구했으면 지도를 아예 그리지 않는다. 쓸 수 없는 좌표로 지도를 만들면 카카오가 중심을
    잡지 못해 **제주 앞바다**를 보여주는데, 화면에는 그냥 "엉뚱한 곳에 가 있는 지도"로만
    보여서 값이 없다는 사실이 드러나지 않는다.
  */
  if (mapData === null) {
    return (
      <View style={[s.map, s.mapFallback]}>
        <Text style={s.stateText}>이 장소의 위치 정보를 아직 받지 못했어요</Text>
      </View>
    );
  }

  return (
    <View
      style={s.map}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setBoxSize((current) =>
          Math.round(current.width) === Math.round(width) &&
          Math.round(current.height) === Math.round(height)
            ? current
            : { width, height },
        );
      }}
    >
      <KakaoMap
        /*
          지도는 **이 좌표·확대로 만들어진다.** 준비된 뒤 명령으로 옮기는 것에만 기대지 않는다.
          명령은 지도가 준비된 뒤에만 닿아서, 준비 전에 보낸 것은 그냥 사라지기 때문이다.

          좌표가 바뀌면 key가 달라져 지도를 새로 만든다. 화면 하나에 장소 하나뿐이라 이 비용은
          들지 않는 것이나 마찬가지고, 대신 "핀이 화면 밖에 있는" 상태가 생길 수 없다.
        */
        key={`${mapData.coordinate.latitude},${mapData.coordinate.longitude}`}
        ref={mapRef}
        center={mapData.coordinate}
        level={PLACE_MAP_LEVEL}
        places={markers}
        // 핀 색 계열은 목록 기본값과 같은 라임으로 둔다. 이 화면에는 혼잡도 토글이 없다.
        filter="relaxed"
        myLocation={null}
        onReady={() => setReady(true)}
        onPinPress={(pinId) => {
          if (pinId !== 'place') router.push(`/pin/${pinId}`);
        }}
        style={s.mapFill}
      />
    </View>
  );
}
