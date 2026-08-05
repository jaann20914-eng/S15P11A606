import { useCallback, useEffect, useRef } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ConfirmModal, ScreenHeader } from '@/components/common';
import { colors } from '@/constants/theme';
import { ActivityCalendarCard } from '@/features/mypage/components/ActivityCalendarCard';
import { MypageMenuList } from '@/features/mypage/components/MypageMenuList';
import { TrustSummaryCard } from '@/features/mypage/components/TrustSummaryCard';
import { useActivityMonth } from '@/features/mypage/hooks/useActivityMonth';
import { useLogout } from '@/features/mypage/hooks/useLogout';
import { useMypageSummary } from '@/features/mypage/hooks/useMypageSummary';
import { mypageStyles as s } from '@/features/mypage/styles';

/**
 * 마이페이지 첫 화면.
 *
 * 뷰 신뢰도와 선택한 달의 활동을 보여준다. 처음에는 파라미터 없이 요청해 서버가 정한
 * 현재 서비스 연월을 받고, 화살표로 그 달을 옮긴다.
 */
export default function MypageScreen() {
  const navigation = useActivityMonth();
  const { profile, loading, error } = useMypageSummary(navigation.month);
  const logout = useLogout();

  /*
    이 화면이 다시 보일 때마다 스크롤을 맨 위로 되돌린다.

    탭을 벗어나면 첫 화면으로 접히는데(popToTopOnBlur), 화면은 살아 있어 스크롤 위치가
    남는다 — 크레딧 내역을 보러 내려갔던 자리에서 입구가 열렸다. 입구는 늘 맨 위여야 한다.
  */
  const scrollRef = useRef<ScrollView>(null);

  useFocusEffect(
    useCallback(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }, []),
  );

  const loadedMonth = profile?.monthlyActivity;
  const { captureServiceMonth } = navigation;

  useEffect(() => {
    if (loadedMonth) captureServiceMonth({ year: loadedMonth.year, month: loadedMonth.month });
  }, [loadedMonth, captureServiceMonth]);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={s.safe}>
      {/* 헤더는 앱 전체가 같은 것을 쓴다. 오른쪽 자리에만 설정 버튼을 넣는다. */}
      <ScreenHeader
        title="마이페이지"
        right={
          <Pressable
            accessibilityLabel="설정"
            onPress={() => router.push('/(tabs)/mypage/edit-nickname')}
            style={s.settingButton}
          >
            <Ionicons name="settings-outline" size={19} color={colors.gray600} />
          </Pressable>
        }
      />

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.summaryContent}
      >
        {/*
          달을 옮기는 동안에도 이미 받은 카드를 지우지 않는다. 매번 화면을 비우면 화살표가
          사라져 연속으로 누를 수 없고 화면이 깜빡인다. 처음 불러올 때만 자리를 비운다.
        */}
        {profile ? (
          <>
            <TrustSummaryCard profile={profile} />
            <ActivityCalendarCard
              activity={profile.monthlyActivity}
              loading={loading}
              canGoPrev={navigation.canGoPrev}
              canGoNext={navigation.canGoNext}
              onPrev={navigation.prev}
              onNext={navigation.next}
            />
          </>
        ) : loading ? (
          <View style={s.loading}>
            <ActivityIndicator color={colors.gray400} />
          </View>
        ) : error !== null ? (
          <View style={s.empty}>
            <Text style={s.emptyText}>{error}</Text>
          </View>
        ) : null}

        <MypageMenuList />

        <Pressable accessibilityRole="button" onPress={logout.ask} style={s.logout}>
          <Text style={s.logoutText}>로그아웃</Text>
        </Pressable>
      </ScrollView>

      <ConfirmModal
        visible={logout.confirming}
        title="로그아웃할까요?"
        message={'다시 이용하려면 로그인해야 해요.\n작성한 핀과 와글 포인트는 그대로 남아 있어요.'}
        confirmLabel="로그아웃"
        busy={logout.busy}
        error={logout.error}
        onCancel={logout.cancel}
        onConfirm={logout.confirm}
      />
    </SafeAreaView>
  );
}
