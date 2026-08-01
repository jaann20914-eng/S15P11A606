import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { ScreenHeader } from '@/components/common';
import { RecommendPlaceInfo } from '@/features/recommend/components/RecommendPlaceInfo';
import { RecommendPlaceMap } from '@/features/recommend/components/RecommendPlaceMap';
import { RecommendPlacePins } from '@/features/recommend/components/RecommendPlacePins';
import { useRecommendedPlace } from '@/features/recommend/hooks/useRecommendedPlace';
import { recommendStyles as s } from '@/features/recommend/styles';
import { useResponsivePadding } from '@/hooks/useResponsivePadding';

/**
 * 추천 장소 상세.
 *
 * 홈의 장소 상세(`app/place/[placeId]`)와 목적이 다르다. 그쪽은 홈 지도 위에 겹치는
 * 바텀시트라 아래에 홈이 깔려 있어야 성립하는데, 추천 목록에서 열면 배경이 목록과 어긋나고
 * 목록으로 돌아가는 길도 시트를 내리는 동작뿐이다.
 *
 * 그래서 추천 안에서는 제 화면으로 연다. 지도는 이 장소 한 점만 찍는 읽기 전용이고
 * (내 위치·검색 없음), 그 아래로 기본정보와 영상핀 목록이 이어진다. 목록으로는 헤더의
 * 뒤로 가기로 돌아간다.
 *
 * `(tabs)` 안에 있으므로 바텀바는 탭 네비게이터가 그린다. 화면에서 따로 그리면 겹친다.
 */
export default function RecommendPlaceScreen() {
  const { placeId } = useLocalSearchParams<{ placeId: string }>();
  const padding = useResponsivePadding();

  // 경로 파라미터는 문자열이다. 숫자가 아니면 조회하지 않고 바로 안내로 넘긴다.
  const parsed = Number(placeId);
  const { place, loading, error } = useRecommendedPlace(Number.isInteger(parsed) ? parsed : null);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={s.safe}>
      <ScreenHeader title="추천 장소" back onBack={router.back} />

      {place === null ? (
        <View style={s.state}>
          {loading ? (
            <ActivityIndicator color={s.stateText.color} />
          ) : (
            <Text style={s.stateText}>{error ?? '장소를 찾을 수 없어요'}</Text>
          )}
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[s.detail, { paddingHorizontal: padding }]}
        >
          <RecommendPlaceMap place={place} />
          <RecommendPlaceInfo place={place} />
          <RecommendPlacePins place={place} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
