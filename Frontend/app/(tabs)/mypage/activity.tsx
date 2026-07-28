import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, layout, radius, spacing, type } from '@/constants/theme';

type PostState = '게시 대기중' | '게시 완료';
const posts: { id: string; time: string; place: string; address: string; state: PostState }[] = [
  { id: 'pending', time: '14:05', place: '바나프레소 역삼점', address: '서울 광진구 동일로 60길 47 1층 (군자동)', state: '게시 대기중' },
  { id: '1', time: '14:00', place: '바나프레소 역삼점', address: '서울 광진구 동일로 60길 47 1층 (군자동)', state: '게시 완료' },
  { id: '2', time: '14:00', place: '바나프레소 역삼점', address: '서울 광진구 동일로 60길 47 1층 (군자동)', state: '게시 완료' },
  { id: '3', time: '14:00', place: '바나프레소 역삼점', address: '서울 광진구 동일로 60길 47 1층 (군자동)', state: '게시 완료' },
];

const navItems = [
  { label: '홈', icon: 'map-outline', path: '/(tabs)/home', capture: false },
  { label: '추천', icon: 'sparkles-outline', path: '/(tabs)/recommend', capture: false },
  { label: '제보', icon: 'add', path: '/(tabs)/write', capture: true },
  { label: '채팅', icon: 'chatbubbles-outline', path: '/(tabs)/chat/sent', capture: false },
  { label: '마이', icon: 'person', path: '/(tabs)/mypage', capture: false },
] as const;

export default function Posts() {
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.screen}>
        <View style={s.header}>
          <Pressable accessibilityLabel="뒤로 가기" onPress={() => router.back()} style={s.headerButton}>
            <Ionicons name="chevron-back" size={24} color={colors.gray400}/>
          </Pressable>
          <Text style={s.headerTitle}>작성한 영상핀</Text>
          <View style={s.headerButton}/>
        </View>

        <View style={s.content}>
          <View style={s.summaryRow}>
            <Text style={s.summary}>오늘 등록한 영상 핀</Text>
            <Text style={s.count}>{posts.length}개</Text>
          </View>

          <View style={s.listCard}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.list}>
              {posts.map((post, index) => {
                const pending = post.state === '게시 대기중';
                return (
                  <Pressable
                    key={post.id}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: pending }}
                    accessibilityHint={pending ? 'AI 블러 처리 중에는 상세 페이지를 열 수 없습니다' : '작성한 영상핀 상세 보기'}
                    disabled={pending}
                    onPress={() => router.push(`/pin/${post.id}` as any)}
                    style={[s.row, index < posts.length - 1 && s.rowBorder]}
                  >
                    <View style={s.timePill}><Text style={s.time}>{post.time}</Text></View>
                    <View style={s.copy}>
                      <Text style={s.place}>{post.place}</Text>
                      <Text numberOfLines={1} style={s.address}>{post.address}</Text>
                      <Text style={[s.state, pending && s.pending]}>{post.state}</Text>
                    </View>
                    {!pending && <Ionicons name="chevron-forward" size={23} color={colors.gray400}/>}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>

        <View style={s.bottomNav}>
          {navItems.map(item => (
            <Pressable key={item.label} onPress={() => router.replace(item.path)} style={s.navItem}>
              <View style={item.capture && s.captureButton}>
                <Ionicons name={item.icon} size={item.capture ? 30 : 21} color={item.label === '마이' ? colors.dark : item.capture ? colors.white : colors.gray400}/>
              </View>
              <Text style={[s.navLabel, item.label === '마이' && s.navActive, item.capture && s.captureLabel]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  screen: { flex: 1 },
  header: {
    height: layout.headerHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.x2,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...type.label, fontWeight: '600', color: colors.gray600 },
  content: { flex: 1, paddingHorizontal: layout.gutter, paddingTop: spacing.x8, paddingBottom: spacing.x4 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.x4, marginBottom: spacing.x5 },
  summary: { ...type.title, color: colors.dark },
  count: { ...type.body, color: colors.gray600 },
  listCard: {
    flex: 1,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
  },
  list: { paddingHorizontal: spacing.x4, paddingBottom: spacing.x4 },
  row: { minHeight: 104, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.x3, paddingVertical: spacing.x4 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.gray200 },
  timePill: { width: 72, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.gray100 },
  time: { ...type.label, color: colors.gray600 },
  copy: { flex: 1, minWidth: 0 },
  place: { ...type.label, fontWeight: '600', color: colors.dark },
  address: { ...type.caption, color: colors.gray400, marginTop: spacing.x1 },
  state: { ...type.caption, color: colors.gray400, marginTop: spacing.x2 },
  pending: { color: '#348BF2', fontWeight: '600' },
  bottomNav: {
    height: 72,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
    backgroundColor: colors.white,
  },
  navItem: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'center' },
  navLabel: { fontSize: 10, lineHeight: 14, fontWeight: '500', color: colors.gray400, marginTop: spacing.x1 },
  navActive: { color: colors.dark, fontWeight: '600' },
  captureButton: {
    width: 54,
    height: 54,
    marginTop: -25,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    borderWidth: 3,
    borderColor: colors.white,
    backgroundColor: '#D9ED76',
    shadowColor: colors.dark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: .18,
    shadowRadius: 8,
    elevation: 7,
  },
  captureLabel: { marginTop: spacing.x2 },
});
