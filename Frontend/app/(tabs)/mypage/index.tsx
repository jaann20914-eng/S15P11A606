import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, layout, radius, spacing, type } from '@/constants/theme';

// 2026년 7월 1일은 수요일입니다. 월요일 시작 달력에 맞춘 빈칸을 포함합니다.
const heat: Array<number | null> = [
  null,
  null,
  0,
  0,
  0,
  1,
  0,
  1,
  1,
  0,
  2,
  0,
  3,
  2,
  0,
  0,
  2,
  0,
  1,
  0,
  0,
  0,
  3,
  0,
  2,
  1,
  0,
  0,
  3,
  2,
  3,
  1,
  0,
  null,
  null,
];
const weekdays = ['월', '화', '수', '목', '금', '토', '일'];
const menus = [
  { label: '오늘 작성한 영상핀', path: '/(tabs)/mypage/activity', icon: 'videocam-outline' },
  { label: '크레딧 내역', path: '/(tabs)/mypage/credits', icon: 'diamond-outline' },
] as const;

export default function My() {
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={s.safe}>
      <View style={s.header}>
        <View style={s.headerSide} />
        <Text style={s.headerTitle}>마이페이지</Text>
        <Pressable
          accessibilityLabel="설정"
          onPress={() => router.push('/(tabs)/mypage/edit-nickname')}
          style={s.setting}
        >
          <Ionicons name="settings-outline" size={19} color={colors.gray600} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
        <View style={s.summaryCard}>
          <View style={s.trustRow}>
            <View style={s.trustRing}>
              <View style={s.trustArc} />
              <View style={s.trustCore}>
                <Text style={s.ringValue}>92.5°</Text>
              </View>
            </View>
            <View style={s.trustCopy}>
              <Text style={s.eyebrow}>나의 뷰 신뢰도</Text>
              <Text style={s.trustValue}>92.5°</Text>
              <Text style={s.trustHelp}>유익한 정보가 쌓이면 신뢰도가 360°에 가까워져요.</Text>
            </View>
          </View>
          <View style={s.metrics}>
            <View style={s.metric}>
              <Text style={s.metricLabel}>보유 크레딧</Text>
              <Text style={s.metricValue}>120</Text>
            </View>
            <View style={s.metricDivider} />
            <View style={s.metric}>
              <Text style={s.metricLabel}>오늘 영상핀</Text>
              <Text style={s.metricValue}>2</Text>
            </View>
          </View>
        </View>

        <View style={s.activityCard}>
          <View style={s.calendar}>
            <View style={s.monthRow}>
              <Ionicons name="chevron-back" size={18} color={colors.gray400} />
              <Text style={s.month}>7월</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.gray400} />
            </View>
            <View style={s.weekRow}>
              {weekdays.map((day) => (
                <Text key={day} style={s.weekday}>
                  {day}
                </Text>
              ))}
            </View>
            <View style={s.heatmap}>
              {heat.map((value, index) => (
                <View
                  key={index}
                  style={[
                    s.cell,
                    value === null
                      ? s.cellBlank
                      : value === 0
                        ? s.cellEmpty
                        : value === 1
                          ? s.cellLow
                          : value === 2
                            ? s.cellMid
                            : s.cellHigh,
                  ]}
                />
              ))}
            </View>
          </View>
          <View style={s.monthStats}>
            <Text style={s.statsTitle}>이번 달 활동</Text>
            <Text style={s.statLine}>작성한 영상핀 · 14개</Text>
            <Text style={s.statLine}>획득 크레딧 · 220</Text>
            <Text style={s.statLine}>도움 열람 · 97회</Text>
          </View>
        </View>

        <Text style={s.sectionTitle}>내 정보와 활동</Text>
        <View style={s.menuList}>
          {menus.map((item, index) => (
            <Pressable
              key={item.label}
              onPress={() => router.push(item.path)}
              style={[s.menu, index < menus.length - 1 && s.menuBorder]}
            >
              <View style={s.menuIcon}>
                <Ionicons name={item.icon} size={18} color={colors.gray600} />
              </View>
              <Text style={s.menuText}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.gray400} />
            </Pressable>
          ))}
        </View>

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

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  header: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.gutter,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  headerSide: { width: 44 },
  headerTitle: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: colors.gray600 },
  setting: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  content: { paddingHorizontal: 18, paddingTop: spacing.x5, paddingBottom: spacing.x6 },
  summaryCard: {
    padding: spacing.x4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#DDECA8',
    backgroundColor: colors.white,
  },
  trustRow: {
    minHeight: 84,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.x4,
    paddingHorizontal: spacing.x2,
  },
  trustRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 8,
    borderColor: '#E1E1E1',
  },
  trustArc: {
    position: 'absolute',
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 8,
    borderColor: 'transparent',
    borderTopColor: '#F1B47E',
    transform: [{ rotate: '24deg' }],
  },
  trustCore: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  ringValue: { fontSize: 14, lineHeight: 20, fontWeight: '500', color: colors.gray600 },
  trustCopy: { flex: 1 },
  eyebrow: { fontSize: 12, lineHeight: 18, color: colors.gray400 },
  trustValue: { fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: -0.5, color: colors.gray600 },
  trustHelp: { maxWidth: 210, fontSize: 10, lineHeight: 15, color: colors.gray400, marginTop: spacing.x1 },
  metrics: {
    height: 88,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.x3,
    borderRadius: radius.card,
    backgroundColor: '#F3F9D5',
  },
  metric: { flex: 1, alignItems: 'center' },
  metricLabel: { fontSize: 12, lineHeight: 18, color: colors.gray600 },
  metricValue: { fontSize: 28, lineHeight: 36, fontWeight: '700', color: colors.gray600, marginTop: 2 },
  metricDivider: { width: 1, height: 44, backgroundColor: '#AEBB7F' },
  activityCard: {
    height: 264,
    flexDirection: 'row',
    marginTop: spacing.x5,
    overflow: 'hidden',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#E2ECC0',
    backgroundColor: '#F5FBDD',
  },
  calendar: {
    width: '68%',
    paddingHorizontal: spacing.x3,
    paddingTop: spacing.x2,
    paddingBottom: spacing.x4,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
  },
  monthRow: { height: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  month: { ...type.title, color: colors.gray600 },
  weekRow: { flexDirection: 'row', marginTop: spacing.x2 },
  weekday: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 10, lineHeight: 15, color: colors.gray600 },
  heatmap: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.x2 },
  cell: { width: `${100 / 7}%`, aspectRatio: 1 },
  cellBlank: { backgroundColor: 'transparent' },
  cellEmpty: { backgroundColor: '#F3F3F3' },
  cellLow: { backgroundColor: '#EFF8B5' },
  cellMid: { backgroundColor: '#D6ED60' },
  cellHigh: { backgroundColor: colors.lime },
  monthStats: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.x3 },
  statsTitle: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
    color: colors.gray600,
    marginBottom: spacing.x3,
  },
  statLine: { fontSize: 9, lineHeight: 17, color: colors.gray600 },
  sectionTitle: { ...type.title, color: colors.dark, marginTop: spacing.x10, marginBottom: spacing.x2 },
  menuList: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.gray200 },
  menu: { height: 58, flexDirection: 'row', alignItems: 'center', gap: spacing.x3 },
  menuBorder: { borderBottomWidth: 1, borderBottomColor: colors.gray100 },
  menuIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gray100,
  },
  menuText: { ...type.body, flex: 1, color: colors.dark },
  logout: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: spacing.x4 },
  logoutText: { ...type.caption, color: colors.gray400 },
});
