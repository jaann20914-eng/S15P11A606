import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/constants/theme';
import type { CrowdFilter } from '@/constants/crowdLevels';
import type { RecommendedPlace } from '@/types/recommend';
import { recommendStyles as s } from '../styles';
import { RecommendCard } from './RecommendCard';
import { RecommendEmpty } from './RecommendEmpty';

export interface RecommendListProps {
  places: RecommendedPlace[];
  mode: CrowdFilter;
  loading: boolean;
  /** 실패 문구. 목록이 비어 있을 때만 보여준다. */
  error: string | null;
  /** 다시 조회한다. 빈 목록 · 실패 화면의 버튼이 부른다. */
  onRetry: () => void;
}

/** 계열별 배경 그라데이션. 여유는 초록·하늘, 와글은 주황·분홍 계열이다. */
const backgroundByMode: Record<CrowdFilter, readonly [string, string, string]> = {
  relaxed: ['#FFFDF3', '#F3FCEB', '#E8F7FC'],
  wagle: ['#FFFDF3', '#FFF3E9', '#FFECEF'],
};

/** 추천 장소 목록. */
export function RecommendList({ places, mode, loading, error, onRetry }: RecommendListProps) {
  return (
    <LinearGradient colors={backgroundByMode[mode]} locations={[0, 0.48, 1]} style={s.listGradient}>
      {loading ? (
        <View style={s.state}>
          <ActivityIndicator color={colors.gray400} />
        </View>
      ) : error !== null ? (
        <View style={s.state}>
          <Text style={s.stateText}>{error}</Text>
          <Pressable accessibilityRole="button" onPress={onRetry} style={s.emptySecondary}>
            <Text style={s.emptySecondaryText}>다시 시도</Text>
          </Pressable>
        </View>
      ) : places.length === 0 ? (
        /*
          비어 있는 것이 흔한 상태다 — 추천은 핀이 달린 장소만 대상으로 하므로 주변에 아직
          올라온 것이 없으면 빈 목록이 온다. 그래서 실패와 구분해 따로 그린다.
        */
        <RecommendEmpty mode={mode} onRetry={onRetry} />
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
