import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/constants/theme';
import type { CrowdFilter } from '@/constants/crowdLevels';
import type { RecommendedPlace } from '@/types/recommend';
import { recommendStyles as s } from '../styles';
import { RecommendCard } from './RecommendCard';

export interface RecommendListProps {
  places: RecommendedPlace[];
  mode: CrowdFilter;
  loading: boolean;
  /** 실패 문구. 목록이 비어 있을 때만 보여준다. */
  error: string | null;
}

/** 계열별 배경 그라데이션. 여유는 초록·하늘, 와글은 주황·분홍 계열이다. */
const backgroundByMode: Record<CrowdFilter, readonly [string, string, string]> = {
  relaxed: ['#FFFDF3', '#F3FCEB', '#E8F7FC'],
  wagle: ['#FFFDF3', '#FFF3E9', '#FFECEF'],
};

/** 추천 장소 목록. */
export function RecommendList({ places, mode, loading, error }: RecommendListProps) {
  return (
    <LinearGradient colors={backgroundByMode[mode]} locations={[0, 0.48, 1]} style={s.listGradient}>
      {loading ? (
        <View style={s.state}>
          <ActivityIndicator color={colors.gray400} />
        </View>
      ) : places.length === 0 ? (
        <View style={s.state}>
          <Text style={s.stateText}>{error ?? '추천할 장소를 찾지 못했어요.'}</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled contentContainerStyle={s.list}>
          {places.map((place) => (
            <RecommendCard key={place.placeId} place={place} mode={mode} />
          ))}
        </ScrollView>
      )}
    </LinearGradient>
  );
}
