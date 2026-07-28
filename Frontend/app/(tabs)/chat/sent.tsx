import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, layout, radius, spacing, type } from '@/constants/theme';

type Tab = '요청한 대화' | '요청받은 대화';
type ChatState = '대기' | '채팅중' | '종료';

const myPosts = [
  { id: 'post-1', time: '14:00', place: '바나프레소 역삼점', address: '서울 광진구 동일로 60길 47 1층 (군자동)' },
  { id: 'post-2', time: '13:00', place: '바나프레소 역삼점', address: '서울 광진구 동일로 60길 47 1층 (군자동)' },
  { id: 'post-3', time: '12:00', place: '바나프레소 역삼점', address: '서울 광진구 동일로 60길 47 1층 (군자동)' },
  { id: 'post-4', time: '11:00', place: '바나프레소 역삼점', address: '서울 광진구 동일로 60길 47 1층 (군자동)' },
];

const receivedRows: { id: string; postId: string; person: string; state: ChatState; message: string }[] = [
  { id: 'received-pending', postId: 'post-1', person: '금쥐', state: '대기', message: '안녕하세요, 아직도 사람 많은가요??' },
  { id: 'received-active', postId: 'post-1', person: '카페 탐험가', state: '채팅중', message: '답변 감사합니다~' },
  { id: 'received-ended', postId: 'post-1', person: '코코', state: '종료', message: '안녕하세요, 아직도 사람 많은가요??' },
];

const requestedRows: { id: string; place: string; person: string; state: ChatState; message: string }[] = [
  { id: 'requested-pending', place: '스타벅스 역삼1점', person: '버거킹님', state: '대기', message: '상대방의 수락을 기다리고 있어요' },
  { id: 'requested-active', place: '스타벅스 역삼1점', person: '아이스크림님', state: '채팅중', message: '답변 감사합니다' },
  { id: 'requested-ended', place: '스타벅스 역삼1점', person: '카페 탐험가', state: '종료', message: '종료된 대화입니다' },
];

export default function Chat() {
  const [tab, setTab] = useState<Tab>('요청받은 대화');
  const [query, setQuery] = useState('');
  const [selectedPost, setSelectedPost] = useState<(typeof myPosts)[number] | null>(null);

  const requested = useMemo(
    () => requestedRows.filter(row => `${row.place}${row.person}`.includes(query)),
    [query],
  );
  const received = useMemo(
    () => receivedRows.filter(row => row.postId === selectedPost?.id && row.person.includes(query)),
    [query, selectedPost],
  );

  const openRoom = (id: string, role: 'owner' | 'requester', state: ChatState) => {
    router.push({ pathname: '/chat-room/[roomId]', params: { roomId: id, role, state } });
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={s.safe}>
      <View style={s.screen}>
        <View style={s.pageHeader}>
          {selectedPost ? <Pressable onPress={() => setSelectedPost(null)} style={s.back}><Ionicons name="chevron-back" size={24} color={colors.gray400}/></Pressable> : <View style={s.back}/>}
          <Text style={s.pageTitle}>{selectedPost ? selectedPost.place : '채팅방'}</Text>
          <View style={s.back}/>
        </View>

        {!selectedPost && <View style={s.tabs}>
          {(['요청한 대화', '요청받은 대화'] as Tab[]).map(item => (
            <Pressable key={item} onPress={() => setTab(item)} style={s.tab}>
              <Text style={[s.tabText, tab === item && s.tabTextActive]}>{item}</Text>
              <View style={[s.tabLine, tab === item && s.tabLineActive]}/>
            </Pressable>
          ))}
        </View>}

        <View style={s.search}>
          <Ionicons name="search" size={21} color={colors.gray400}/>
          <TextInput value={query} onChangeText={setQuery} placeholder="장소나 닉네임을 검색하세요" placeholderTextColor={colors.gray400} style={s.input}/>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.list}>
          {tab === '요청받은 대화' && !selectedPost && myPosts.map(post => (
            <Pressable key={post.id} onPress={() => { setSelectedPost(post); setQuery(''); }} style={s.postRow}>
              <View style={s.timePill}><Text style={s.timePillText}>{post.time}</Text></View>
              <View style={s.rowCopy}><Text style={s.rowTitle}>{post.place}</Text><Text style={s.address}>{post.address}</Text></View>
              <Ionicons name="chevron-forward" size={20} color={colors.gray400}/>
            </Pressable>
          ))}

          {tab === '요청받은 대화' && selectedPost && received.map(row => (
            <Pressable key={row.id} onPress={() => openRoom(row.id, 'owner', row.state)} style={s.chatRow}>
              <View style={s.viewRing}><Text style={s.viewText}>92°</Text></View>
              <View style={s.rowCopy}>
                <View style={s.rowTitleLine}>
                  <Text numberOfLines={1} style={s.rowTitle}>스타벅스 역삼1점 · {row.person}</Text>
                  <Text style={[s.state, row.state === '대기' && s.pending, row.state === '채팅중' && s.active, row.state === '종료' && s.ended]}>{row.state}</Text>
                  {row.state === '대기' && <View style={s.unread}/>}
                </View>
                <Text style={s.address}>14:02 작성 · 대화가 진행 중이에요</Text>
                <Text numberOfLines={1} style={s.message}>{row.message}</Text>
                <Text style={s.requestTime}>14:08 요청</Text>
              </View>
            </Pressable>
          ))}

          {tab === '요청한 대화' && requested.map(row => (
            <Pressable key={row.id} onPress={() => openRoom(row.id, 'requester', row.state)} style={s.chatRow}>
              <View style={s.viewRing}><Text style={s.viewText}>92°</Text></View>
              <View style={s.rowCopy}>
                <View style={s.rowTitleLine}>
                  <Text numberOfLines={1} style={s.rowTitle}>{row.place} · {row.person}</Text>
                  <Text style={[s.state, row.state === '대기' && s.pending, row.state === '채팅중' && s.active, row.state === '종료' && s.ended]}>{row.state}</Text>
                </View>
                <Text numberOfLines={1} style={s.message}>{row.message}</Text>
                <Text style={s.requestTime}>14:08</Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>

        {selectedPost && <View style={s.leaveArea}><Text style={s.leaveHint}>모든 답변을 종료합니다</Text><Pressable style={s.leaveButton}><Text style={s.leaveText}>떠났어요</Text></Pressable></View>}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  screen: { flex: 1, paddingHorizontal: layout.gutter },
  pageHeader: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  pageTitle: { ...type.title, color: colors.dark },
  tabs: { height: 52, flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.gray200 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  tabText: { ...type.label, color: colors.gray400, paddingBottom: spacing.x3 },
  tabTextActive: { color: colors.dark, fontWeight: '600' },
  tabLine: { height: 3, width: '100%', backgroundColor: 'transparent' },
  tabLineActive: { backgroundColor: colors.dark },
  search: { height: 48, marginVertical: spacing.x3, paddingHorizontal: spacing.x3, flexDirection: 'row', alignItems: 'center', gap: spacing.x2, borderRadius: radius.md, backgroundColor: colors.gray100 },
  input: { ...type.body, flex: 1, color: colors.dark },
  list: { paddingBottom: spacing.x6 },
  postRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: spacing.x3, borderBottomWidth: 1, borderBottomColor: colors.gray200 },
  timePill: { width: 68, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.gray100 },
  timePillText: { ...type.label, color: colors.gray600 },
  chatRow: { minHeight: 100, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.x3, paddingVertical: spacing.x3, borderBottomWidth: 1, borderBottomColor: colors.gray200 },
  viewRing: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.lime },
  viewText: { fontSize: 10, lineHeight: 14, color: colors.gray600 },
  rowCopy: { flex: 1 },
  rowTitleLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.x2 },
  rowTitle: { ...type.label, flexShrink: 1, color: colors.dark, fontWeight: '600' },
  address: { ...type.caption, color: colors.gray400, marginTop: 2 },
  message: { ...type.small, color: colors.gray600, marginTop: spacing.x2 },
  requestTime: { fontSize: 10, lineHeight: 14, color: colors.gray400, marginTop: 2 },
  state: { ...type.caption, fontWeight: '600' },
  pending: { color: '#FF7580' },
  active: { color: colors.success },
  ended: { color: colors.gray400 },
  unread: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.lime },
  leaveArea: { paddingTop: spacing.x3, paddingBottom: spacing.x2 },
  leaveHint: { ...type.caption, color: colors.gray400, marginBottom: spacing.x2 },
  leaveButton: { height: 52, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.dark },
  leaveText: { fontSize: 16, lineHeight: 22, fontWeight: '600', color: '#D9ED76' },
});
