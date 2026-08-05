import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { ScreenHeader } from '@/components/common';
import { RecommendPlaceInfo } from '@/features/recommend/components/RecommendPlaceInfo';
import { RecommendPlaceMap } from '@/features/recommend/components/RecommendPlaceMap';
import { RecommendPlacePins } from '@/features/recommend/components/RecommendPlacePins';
import { useRecommendPlaceDetail } from '@/features/recommend/hooks/useRecommendPlaceDetail';
import { recommendStyles as s } from '@/features/recommend/styles';
import type { CrowdFilter } from '@/constants/crowdLevels';
import { colors } from '@/constants/theme';

/**
 * 추천 장소 상세.
 *
 * 홈의 장소 상세(`app/place/[placeId]`)와 목적이 다르다. 그쪽은 홈 지도 위에 겹치는
 * 바텀시트라 아래에 홈이 깔려 있어야 성립하는데, 추천 목록에서 열면 배경이 목록과 어긋나고
 * 목록으로 돌아가는 길도 시트를 내리는 동작뿐이다.
 *
 * 그래서 추천 안에서는 제 화면으로 연다. 지도는 이 장소 한 점만 찍는 읽기 전용이고
 * (내 위치·검색 없음), 그 아래로 기본정보와 영상핀 목록이 이어진다.
 *
 * `(tabs)` 안에 있으므로 바텀바는 탭 네비게이터가 그린다. 화면에서 따로 그리면 겹친다.
 */
export default function RecommendPlaceScreen() {
  const { placeId, latitude, longitude, filter } = useLocalSearchParams<{
    placeId: string;
    latitude?: string;
    longitude?: string;
    /** 어느 목록(여유·와글)에서 열었는지. 지도 핀 색이 이 값을 따른다. */
    filter?: string;
  }>();

  // 목록을 거치지 않고 들어오면 없다. 기본은 여유(라임)로 둔다.
  const pinFilter: CrowdFilter = filter === 'wagle' ? 'wagle' : 'relaxed';

  // 경로 파라미터는 문자열이다. 숫자가 아니면 조회하지 않고 바로 안내로 넘긴다.
  const parsed = Number(placeId);

  /*
    목록에서 넘겨준 장소 좌표. 지도를 그 자리로 만들고, 영상핀 좌표를 받아 올 때도 그 주변만
    물어본다. 목록을 거치지 않고 들어오면(주소로 바로 열기 등) 없으므로 훅이 알아서 찾는다.
  */
  const known = useMemo(() => {
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { latitude: lat, longitude: lng };
  }, [latitude, longitude]);

  const { detail, mapData, loading, error } = useRecommendPlaceDetail(
    Number.isInteger(parsed) ? parsed : null,
    known,
  );

  /*
    지도의 마커와 아래 카드를 잇는 선택 상태. 홈의 영상핀 선택과 같은 동선이다.

    마커를 누르면 그 마커가 뾰족한 핀으로 바뀌고 해당 카드에 라임 테두리가 둘리며, 스크롤이
    그 카드로 내려간다. 상세로 여는 것은 카드를 눌렀을 때만이다 — 지도에서 누르는 것은
    "이게 어느 영상인지 보자"이지 "열자"가 아니다.
  */
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  /** 핀 목록 묶음이 스크롤 내용 안에서 시작하는 위치. 카드 위치와 더해 스크롤 지점을 만든다. */
  const pinSectionYRef = useRef(0);
  /** 카드별 위치(목록 윗변 기준). 목록이 알려 준 값을 모아 둔다. */
  const cardPositionsRef = useRef<Record<string, number>>({});

  const rememberCardPosition = useCallback((pinId: string, y: number) => {
    cardPositionsRef.current[pinId] = y;
  }, []);

  const selectPin = useCallback((pinId: string) => {
    setSelectedPinId(pinId);

    const cardY = cardPositionsRef.current[pinId];

    // 좌표가 있는데 카드가 없는 핀(집계 어긋남)일 수 있다. 그때는 표시만 하고 머문다.
    if (cardY === undefined) return;

    scrollRef.current?.scrollTo({
      y: Math.max(0, pinSectionYRef.current + cardY - 12),
      animated: true,
    });
  }, []);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={s.detailSafe}>
      <ScreenHeader title="추천 장소" back onBack={router.back} />

      {detail === null ? (
        <View style={s.state}>
          {loading ? (
            <ActivityIndicator color={colors.gray400} />
          ) : (
            <Text style={s.stateText}>{error ?? '장소를 찾을 수 없어요'}</Text>
          )}
        </View>
      ) : (
        <>
          {/*
            지도는 스크롤 밖에 **고정**한다. 카드를 훑는 동안에도 어느 자리 이야기인지 계속
            보여야 하고, 마커로 고른 카드를 찾으러 내려갈 때 기준점이 함께 사라지면 안 된다.
            좌우 여백 없이 화면 폭을 그대로 쓴다(시안).
          */}
          <RecommendPlaceMap
            name={detail.place.name}
            mapData={mapData}
            filter={pinFilter}
            selectedPinId={selectedPinId}
            onSelectPin={selectPin}
          />

          <ScrollView
            ref={scrollRef}
            style={s.detailScroll}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.detail}
          >
            <View style={s.detailBody}>
              {/*
                요일별 혼잡도 그래프와 영상핀 카드는 장소 상세와 같은 것을 쓴다
                (`src/components/place`). 그 화면에 있던 구현을 공용으로 뺀 것이라 두 화면의
                모양이 갈라지지 않는다.
              */}
              <RecommendPlaceInfo place={detail.place} weeklyCrowdStats={detail.weeklyCrowdStats} />
              <View
                onLayout={(event) => {
                  pinSectionYRef.current = event.nativeEvent.layout.y;
                }}
              >
                <RecommendPlacePins
                  pins={detail.pins}
                  placeName={detail.place.name}
                  selectedPinId={selectedPinId}
                  onCardPosition={rememberCardPosition}
                />
              </View>
            </View>
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  );
}
