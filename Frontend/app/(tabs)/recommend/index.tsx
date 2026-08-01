import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RecommendIntro } from '@/features/recommend/components/RecommendIntro';
import { RecommendList } from '@/features/recommend/components/RecommendList';
import { useRecommendations } from '@/features/recommend/hooks/useRecommendations';
import { recommendStyles as s } from '@/features/recommend/styles';
import { useResponsivePadding } from '@/hooks/useResponsivePadding';

/**
 * 추천 장소.
 *
 * 이 화면은 `(tabs)` 안에 있어 바텀바는 탭 네비게이터가 그린다. 화면에서 따로 그리면 겹친다.
 *
 * 어느 장소를 추천할지는 서버가 정한다. 화면은 계열(여유·와글)을 고르고 받은 목록을 그린다.
 */
export default function RecommendScreen() {
  const padding = useResponsivePadding();
  const { mode, places, generatedAt, isFallback, loading, error, setMode } = useRecommendations();

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={s.safe}>
      <View style={s.header}>
        <Text style={s.headerTitle}>추천 장소</Text>
      </View>

      <View style={s.content}>
        <RecommendIntro
          mode={mode}
          generatedAt={generatedAt}
          isFallback={isFallback}
          padding={padding}
          onModeChange={setMode}
        />

        <RecommendList places={places} mode={mode} loading={loading} error={error} />
      </View>
    </SafeAreaView>
  );
}
