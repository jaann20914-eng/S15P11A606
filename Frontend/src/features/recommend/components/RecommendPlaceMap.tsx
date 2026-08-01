import { useEffect, useMemo, useRef, useState } from 'react';
import { Text, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { KakaoMap, type KakaoMapHandle } from '@/components/home/KakaoMap';
import type { PlaceMapData } from '@/api/place/coordinates';
import type { Coordinate } from '@/store/useMapStore';
import { RECOMMEND_MAP_HEIGHT, recommendStyles as s } from '../styles';

export interface RecommendPlaceMapProps {
  name: string;
  /** 구하지 못했으면 null. 그때는 지도 대신 안내를 보여준다. */
  mapData: PlaceMapData | null;
}

/**
 * 핀이 하나뿐일 때 쓰는 확대 레벨. 홈 기본값(5)은 동네 전체가 들어와 한 곳을 짚어 주지 못한다.
 *
 * 여러 개면 이 값을 쓰지 않는다. 핀이 다 들어오도록 지도가 스스로 배율을 계산한다.
 */
const SINGLE_PIN_LEVEL = 3;

/**
 * 지도 레벨 3에서 1픽셀이 덮는 거리(m). 레벨이 하나 오를 때마다 두 배가 된다.
 *
 * 실측값이다. 375px 폭에서 레벨 3의 가로 범위가 약 380m였다.
 */
const METERS_PER_PIXEL_AT_LEVEL_3 = 1;

/** 계산으로 나오는 레벨의 한계. 너무 당기면 어디인지 알 수 없고, 너무 물러나면 핀이 뭉친다. */
const MIN_LEVEL = 2;
const MAX_LEVEL = 8;

/** 핀이 화면 가장자리에 걸리지 않도록 비워 둘 여백(px). 세로는 핀 그림 높이를 감안해 더 준다. */
const EDGE_PADDING_X = 48;
const EDGE_PADDING_Y = 56;

/** 위도 1도의 거리(m). 경도는 위도에 따라 줄어들어 따로 계산한다. */
const METERS_PER_LATITUDE_DEGREE = 111_320;

/**
 * 핀이 모두 들어오는 확대 레벨.
 *
 * `fitPlaces`(지도 쪽 영역 맞춤)를 쓰지 않는 이유가 두 가지다.
 * - 그 함수의 여백이 전체화면 지도 기준(좌우 96px)이라 이 260px 칸에서는 과하게 물러난다
 * - 준비된 뒤 명령으로 맞추는 방식이라, 명령이 늦거나 유실되면 화면이 어긋난 채 남는다
 *
 * 여기서 계산해 지도를 만들 때 넣으면 첫 프레임부터 맞는다.
 */
function levelFor(
  points: { latitude: number; longitude: number }[],
  boxWidth: number,
  boxHeight: number,
): number {
  const latitudes = points.map((point) => point.latitude);
  const longitudes = points.map((point) => point.longitude);

  const latitudeSpan = Math.max(...latitudes) - Math.min(...latitudes);
  const longitudeSpan = Math.max(...longitudes) - Math.min(...longitudes);
  const middleLatitude = (Math.max(...latitudes) + Math.min(...latitudes)) / 2;

  const heightMeters = latitudeSpan * METERS_PER_LATITUDE_DEGREE;
  const widthMeters =
    longitudeSpan * METERS_PER_LATITUDE_DEGREE * Math.cos((middleLatitude * Math.PI) / 180);

  const usableWidth = Math.max(boxWidth - EDGE_PADDING_X * 2, 1);
  const usableHeight = Math.max(boxHeight - EDGE_PADDING_Y * 2, 1);

  // 가로·세로 중 더 빡빡한 쪽에 맞춘다. 한쪽만 보면 다른 쪽이 잘린다.
  const requiredMetersPerPixel = Math.max(widthMeters / usableWidth, heightMeters / usableHeight);
  if (requiredMetersPerPixel <= 0) return MIN_LEVEL;

  const level = 3 + Math.log2(requiredMetersPerPixel / METERS_PER_PIXEL_AT_LEVEL_3);
  return Math.min(Math.max(Math.ceil(level), MIN_LEVEL), MAX_LEVEL);
}

/** 좌표들의 한가운데. 지도를 여기에 놓으면 어느 핀도 한쪽으로 치우치지 않는다. */
function centerOf(points: { latitude: number; longitude: number }[]): Coordinate {
  const total = points.reduce(
    (sum, point) => ({
      latitude: sum.latitude + point.latitude,
      longitude: sum.longitude + point.longitude,
    }),
    { latitude: 0, longitude: 0 },
  );

  return {
    latitude: total.latitude / points.length,
    longitude: total.longitude / points.length,
  };
}

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
  const { width: windowWidth } = useWindowDimensions();
  const mapRef = useRef<KakaoMapHandle>(null);
  const [ready, setReady] = useState(false);
  /** 지도 칸의 실제 크기. 값이 바뀔 때마다 지도에 알려 준다. */
  const [boxSize, setBoxSize] = useState({ width: 0, height: 0 });

  /*
    핀은 실제 영상핀만 찍는다.

    올라온 것이 없으면 지도도 비운다. 장소 자리에 하나 찍어 두면 "여기 영상핀이 있다"로
    읽혀서, 바로 아래에서 아직 없다고 안내하는 것과 어긋난다. 그때 할 일은 작성뿐이라
    그 안내(작성하러 가기)만 남긴다.
  */
  const markers = useMemo(
    () =>
      (mapData?.activePins ?? []).map((pin) => ({
        id: pin.pinId,
        name: `${name} 영상핀`,
        latitude: pin.latitude,
        longitude: pin.longitude,
      })),
    [mapData, name],
  );

  /*
    지도의 기준은 **핀들의 한가운데**다. 장소 좌표가 아니다.

    장소 좌표는 그 장소를 대표하는 점 하나일 뿐이라, 핀들이 한쪽에 몰려 있으면 화면 구석에
    걸리거나 밖으로 나간다. 여기서 사용자가 보려는 것은 "영상들이 어디서 찍혔나"이므로 그
    점들의 가운데에 놓는 편이 맞다. 핀이 없을 때만 장소 좌표를 쓴다.
  */
  const focus = useMemo(
    () => (markers.length > 0 ? centerOf(markers) : (mapData?.coordinate ?? null)),
    [mapData, markers],
  );

  /**
   * 확대 레벨. 핀이 여럿이면 다 들어오도록 계산하고, 하나면 그 자리를 크게 보여준다.
   *
   * 지도 칸은 화면 폭을 그대로 쓰고 높이는 스타일에 정해져 있다(`s.map`). 재서 쓰지 않는
   * 이유는, 이 화면이 탭 안에 있어 숨겨진 채 마운트되면 첫 측정이 0으로 오기 때문이다.
   */
  const level = useMemo(
    () =>
      markers.length > 1
        ? levelFor(markers, windowWidth, RECOMMEND_MAP_HEIGHT)
        : SINGLE_PIN_LEVEL,
    [markers, windowWidth],
  );

  /*
    지도 칸의 크기가 정해지거나 바뀌면 다시 맞춘다.

    지도는 만들어지는 순간의 컨테이너 크기를 기준으로 중심과 배율을 계산한다. 그런데 WebView가
    최종 크기를 갖는 시점은 그보다 늦을 수 있고(스크롤 안에 놓인 경우가 그렇다), 그러면 지도는
    **자기가 더 작거나 크다고 믿은 채** 계산한다. 화면에는 핀이 한참 치우쳐 있거나 아예 밖으로
    나가 보인다.

    `relayout`으로 크기를 다시 읽힌 뒤 중심을 다시 확정한다. 확대는 건드리지 않는다 — 만들 때
    이미 넣었고(`level`), 확대 애니메이션은 시작 시점의 중심을 붙잡고 있다가 끝나면서 방금 옮긴
    중심을 되돌린다.
  */
  useEffect(() => {
    if (!ready || focus === null) return;
    if (boxSize.width === 0 || boxSize.height === 0) return;

    mapRef.current?.relayout();
    mapRef.current?.panTo(focus, { animate: false });
  }, [boxSize, focus, ready]);

  /*
    좌표는 장소 상세 응답에 없어 목록 API로 따로 구한다(`api/place/coordinates.ts`).

    못 구했으면 지도를 아예 그리지 않는다. 쓸 수 없는 좌표로 지도를 만들면 카카오가 중심을
    잡지 못해 **제주 앞바다**를 보여주는데, 화면에는 그냥 "엉뚱한 곳에 가 있는 지도"로만
    보여서 값이 없다는 사실이 드러나지 않는다.
  */
  if (focus === null) {
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
          지도는 **핀들의 한가운데에서 만들어진다.** 준비된 뒤 명령으로 옮기는 것에만 기대지
          않는다. 명령은 지도가 준비된 뒤에만 닿아서, 준비 전에 보낸 것은 그냥 사라진다.

          기준점이 바뀌면 key가 달라져 지도를 새로 만든다. 화면 하나에 장소 하나뿐이라 이 비용은
          들지 않는 것이나 마찬가지고, 대신 "핀이 화면 밖에 있는" 상태가 생길 수 없다.
        */
        key={`${focus.latitude},${focus.longitude}`}
        ref={mapRef}
        center={focus}
        level={level}
        places={markers}
        // 핀 색 계열은 목록 기본값과 같은 라임으로 둔다. 이 화면에는 혼잡도 토글이 없다.
        filter="relaxed"
        myLocation={null}
        onReady={() => setReady(true)}
        onPinPress={(pinId) => router.push(`/pin/${pinId}`)}
        style={s.mapFill}
      />
    </View>
  );
}
