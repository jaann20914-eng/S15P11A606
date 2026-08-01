import { useMemo } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { ScreenHeader } from '@/components/common';
import { RecommendPlaceInfo } from '@/features/recommend/components/RecommendPlaceInfo';
import { RecommendPlaceMap } from '@/features/recommend/components/RecommendPlaceMap';
import { RecommendPlacePins } from '@/features/recommend/components/RecommendPlacePins';
import { useRecommendPlaceDetail } from '@/features/recommend/hooks/useRecommendPlaceDetail';
import { recommendStyles as s } from '@/features/recommend/styles';
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
  const { placeId, latitude, longitude } = useLocalSearchParams<{
    placeId: string;
    latitude?: string;
    longitude?: string;
  }>();

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
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.detail}>
          {/* 지도는 좌우 여백 없이 화면 폭을 그대로 쓴다(시안). */}
          <RecommendPlaceMap name={detail.place.name} mapData={mapData} />

          <View style={s.detailBody}>
            {/*
              요일별 혼잡도 그래프와 영상핀 카드는 장소 상세와 같은 것을 쓴다
              (`src/components/place`). 그 화면에 있던 구현을 공용으로 뺀 것이라 두 화면의
              모양이 갈라지지 않는다.
            */}
            <RecommendPlaceInfo place={detail.place} weeklyCrowdStats={detail.weeklyCrowdStats} />
            <RecommendPlacePins pins={detail.pins} placeName={detail.place.name} />
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
