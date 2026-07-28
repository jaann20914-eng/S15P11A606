import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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

// 이 화면은 (tabs) 안에 있어 바텀바는 탭 네비게이터가 그린다. 화면에서 따로 그리면 바가 두 개로 겹친다.
export default function Posts() {
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={s.safe}>
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
                    onPress={() => router.push(`/pin/${post.id}/edit` as any)}
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
});
