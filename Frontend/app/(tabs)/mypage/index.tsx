import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '@/constants/theme';
import { ActivityCalendarCard } from '@/features/mypage/components/ActivityCalendarCard';
import { MypageMenuList } from '@/features/mypage/components/MypageMenuList';
import { TrustSummaryCard } from '@/features/mypage/components/TrustSummaryCard';
import { useMypageSummary } from '@/features/mypage/hooks/useMypageSummary';
import { mypageStyles as s } from '@/features/mypage/styles';

/** 마이페이지 첫 화면. 뷰 신뢰도와 이번 달 활동을 보여주고 하위 화면으로 넘긴다. */
export default function MypageScreen() {
  const { summary, activity, loading } = useMypageSummary();

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={s.safe}>
      <View style={s.rootHeader}>
        <View style={s.rootHeaderSide} />
        <Text style={s.rootHeaderTitle}>마이페이지</Text>
        <Pressable
          accessibilityLabel="설정"
          onPress={() => router.push('/(tabs)/mypage/edit-nickname')}
          style={s.settingButton}
        >
          <Ionicons name="settings-outline" size={19} color={colors.gray600} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.summaryContent}>
        {loading ? (
          <View style={s.loading}>
            <ActivityIndicator color={colors.gray400} />
          </View>
        ) : (
          <>
            {summary && <TrustSummaryCard summary={summary} />}
            {activity && <ActivityCalendarCard activity={activity} />}
          </>
        )}

        <MypageMenuList />

        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace('/(auth)/login')}
          style={s.logout}
        >
          <Text style={s.logoutText}>로그아웃</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
