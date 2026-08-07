import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useIsFocused } from '@react-navigation/native';

import { ScreenHeader } from '@/components/common';
import { colors } from '@/constants/theme';
import type { CrowdFilter } from '@/constants/crowdLevels';
import { RecommendEmpty } from '@/features/recommend/components/RecommendEmpty';
import { RecommendIntro } from '@/features/recommend/components/RecommendIntro';
import { RecommendPager } from '@/features/recommend/components/RecommendPager';
import { useRecommendations } from '@/features/recommend/hooks/useRecommendations';
import { recommendStyles as s } from '@/features/recommend/styles';
import { useResponsivePadding } from '@/hooks/useResponsivePadding';

/** 계열별 배경 그라데이션. 여유는 초록·하늘, 와글은 주황·분홍 계열이다. */
const backgroundByMode: Record<CrowdFilter, readonly [string, string, string]> = {
  relaxed: ['#FFFDF3', '#F3FCEB', '#E8F7FC'],
  wagle: ['#FFFDF3', '#FFF3E9', '#FFECEF'],
};

/**
 * 추천 장소.
 *
 * 장소 하나가 카드 한 장이고, 그 안에 지도와 핀 목록이 함께 들어 있다. 예전에는 목록에서
 * 장소를 골라 상세로 들어가야 핀을 볼 수 있었는데, 추천은 "지금 어디로 갈까"를 훑는 자리라
 * 한 번 더 들어가는 단계가 흐름을 끊었다. 장소는 옆으로, 핀은 아래로 넘긴다.
 *
 * 이 화면은 `(tabs)` 안에 있어 바텀바는 탭 네비게이터가 그린다. 화면에서 따로 그리면 겹친다.
 *
 * 어느 장소를 추천할지는 서버가 정한다. 화면은 계열(여유·와글)을 고르고 받은 목록을 그린다.
 */
export default function RecommendScreen() {
  const padding = useResponsivePadding();
  const { mode, places, generatedAt, isFallback, loading, error, setMode, reload } = useRecommendations();

  /** 지금 보고 있는 장소의 자리. 캐러셀이 아니라 화면이 들고 있어야 아래에서 되감을 수 있다. */
  const [index, setIndex] = useState(0);

  /*
    계열을 바꾸면 첫 장소부터 본다. 여유의 다섯 번째를 보다가 와글로 넘기면 목록이 통째로
    바뀌는데, 자리만 그대로면 뜬금없는 장소가 열린다.
  */
  useEffect(() => {
    setIndex(0);
  }, [mode]);

  const focused = useIsFocused();

  /*
    탭을 다녀오면 첫 장소로 되감는다(제품 결정).

    이 화면은 탭 안이라 다른 탭으로 가도 살아 있어서, 되감지 않으면 다섯 번째 장소를 보던
    자리가 그대로 남는다. 추천은 "지금 어디로 갈까"를 처음부터 훑는 자리라 입구가 늘 같아야
    한다. 핀 상세는 이 탭 위에 얹히는 화면이라 초점을 뺏지 않는다 — 거기서 뒤로 오면 보던
    장소 그대로다.
  */
  useEffect(() => {
    if (!focused) setIndex(0);
  }, [focused]);

  /*
    초점을 되찾을 때마다 올린다. 열려 있는 카드들이 이 값을 보고 장소 내용을 다시 받는다.

    핀 상세에서 **내 핀을 고치거나 지우고 돌아온 경우**가 이유다. 목록 자체는
    `useRecommendations`가 다시 받지만, 카드 안의 핀 내용은 장소 상세에서 따로 오므로
    그쪽도 함께 새로 받아야 지운 핀이 사라지고 고친 내용이 반영된다.

    첫 초점은 건너뛴다. 그때는 카드가 방금 받아 온 참이라 같은 것을 두 번 묻게 된다.
  */
  const [reloadToken, setReloadToken] = useState(0);
  const focusedOnce = useRef(false);

  useEffect(() => {
    if (!focused) return;

    if (!focusedOnce.current) {
      focusedOnce.current = true;
      return;
    }

    setReloadToken((token) => token + 1);
  }, [focused]);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={s.safe}>
      {/* 탭 화면이라 뒤로 가기가 없다. 그 자리는 공용 헤더가 비워 둬서 제목이 가운데에 온다. */}
      <ScreenHeader title="추천 장소" />

      {/*
        머리말부터 카드까지 한 덩어리로 색을 깐다. 계열을 바꾸면 화면 전체의 공기가 바뀌어,
        지금 무엇을 보고 있는지가 토글을 보지 않아도 읽힌다.
      */}
      <LinearGradient colors={backgroundByMode[mode]} locations={[0, 0.48, 1]} style={s.screenGradient}>
        <RecommendIntro mode={mode} isFallback={isFallback} padding={padding} onModeChange={setMode} />

        {loading ? (
          <View style={s.state}>
            <ActivityIndicator color={colors.gray400} />
          </View>
        ) : error !== null ? (
          <View style={s.state}>
            <Text style={s.stateText}>{error}</Text>
            <Pressable accessibilityRole="button" onPress={reload} style={s.emptySecondary}>
              <Text style={s.emptySecondaryText}>다시 시도</Text>
            </Pressable>
          </View>
        ) : places.length === 0 ? (
          /*
            비어 있는 것이 흔한 상태다 — 추천은 핀이 달린 장소만 대상으로 하므로 주변에 아직
            올라온 것이 없으면 빈 목록이 온다. 그래서 실패와 구분해 따로 그린다.
          */
          <RecommendEmpty mode={mode} onRetry={reload} />
        ) : (
          <RecommendPager
            places={places}
            mode={mode}
            index={index}
            onIndexChange={setIndex}
            generatedAt={generatedAt}
            reloadToken={reloadToken}
          />
        )}
      </LinearGradient>
    </SafeAreaView>
  );
}
