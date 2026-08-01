import { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, layout, radius, spacing, type } from '@/constants/theme';

type Message = { id: number; side: 'me' | 'them'; text: string; time: string };
const quick = ['좌석 남아있나요?', '지금 웨이팅 얼마나 돼요?', '주차되나요?'];

export default function Room() {
  const { role, state } = useLocalSearchParams<{ role?: string; state?: string }>();
  const isOwner = role === 'owner';
  const initialState = state === '대기' ? 'pending' : state === '종료' ? 'left' : 'accepted';
  const [requestState, setRequestState] = useState<'pending' | 'accepted' | 'left' | 'rejected'>(
    initialState,
  );
  const [text, setText] = useState('');
  const requesterMessages: Message[] =
    requestState === 'pending'
      ? [{ id: 1, side: 'me', text: '안녕하세요. 아직도 사람 많을까요?', time: '14:08' }]
      : [
          { id: 1, side: 'me', text: '안녕하세요. 아직도 사람 많을까요?', time: '14:08' },
          { id: 2, side: 'them', text: '안녕하세요. 아직 자리가 있어요.', time: '14:08' },
          { id: 3, side: 'them', text: '창가 쪽은 조금 여유로워요.', time: '14:08' },
        ];
  const [messages, setMessages] = useState<Message[]>(
    isOwner
      ? [
          { id: 1, side: 'them', text: '안녕하세요. 아직도 사람 많을까요?', time: '14:08' },
          { id: 2, side: 'them', text: '010-1111-1111로 전화 주세요', time: '14:08' },
        ]
      : requesterMessages,
  );
  const [aiAlert, setAiAlert] = useState(false);
  const send = (value = text) => {
    const next = value.trim();
    if (!next) return;
    setMessages((current) => [...current, { id: Date.now(), side: 'me', text: next, time: '18:08' }]);
    if (/010|전화번호|카카오톡|텔레그램|계좌|입금/.test(next)) setAiAlert(true);
    setText('');
  };
  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} style={s.back}>
            <Ionicons name="chevron-back" size={24} color={colors.gray400} />
          </Pressable>
          <View style={s.headerCopy}>
            <Text style={s.headerTitle}>스타벅스 역삼1점 · 14:00 작성</Text>
            <Text style={s.headerMeta}>서울 광진구 동일로 60길 47 1층</Text>
          </View>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.messages}>
          {isOwner && requestState === 'pending' && (
            <View style={s.requestCard}>
              <Text style={s.requestTitle}>새 채팅 요청이 도착했어요</Text>
              <Text style={s.requestText}>
                요청을 수락하면 요청자에게서 5크레딧이 차감되고 나에게 5크레딧이 적립돼요.
              </Text>
              <View style={s.requestActions}>
                <Pressable
                  onPress={() => setRequestState('accepted')}
                  style={[s.requestButton, s.limeButton]}
                >
                  <Text style={s.limeText}>수락해요</Text>
                </Pressable>
                <Pressable
                  onPress={() => setRequestState('rejected')}
                  style={[s.requestButton, s.grayButton]}
                >
                  <Text style={s.grayText}>거절해요</Text>
                </Pressable>
              </View>
            </View>
          )}
          {!isOwner && requestState === 'pending' && (
            <View style={s.requestCard}>
              <Text style={s.requestTitle}>새 채팅을 요청했어요</Text>
              <Text style={s.requestText}>
                메시지를 전달했어요. 상대방이 채팅을 시작하면 5크레딧 차감 후 대화를 이어갈 수 있습니다.
              </Text>
            </View>
          )}
          {requestState === 'left' && (
            <View style={s.endedCard}>
              <Text style={s.endedTitle}>채팅이 종료되었습니다</Text>
              <Text style={s.endedDescription}>상대방이 대화를 종료하여 더이상 채팅입력이 불가합니다.</Text>
            </View>
          )}
          {!isOwner && messages.length === 0 && (
            <View style={s.empty}>
              <Text style={s.emptyTitle}>메시지를 먼저 보내보세요</Text>
              <Text style={s.emptyText}>상대방이 채팅을 수락하면 대화를 이어갈 수 있어요.</Text>
            </View>
          )}
          {messages.map((message, index) => (
            <View key={message.id}>
              <View style={[s.messageLine, message.side === 'me' && s.messageLineMe]}>
                {message.side === 'them' && <View style={s.avatar} />}
                <View style={[s.bubble, message.side === 'me' ? s.meBubble : s.themBubble]}>
                  <Text style={s.messageText}>{message.text}</Text>
                </View>
                <Text style={s.time}>{message.time}</Text>
              </View>
              {aiAlert && index === (isOwner ? 1 : 0) && (
                <View style={s.aiWarning}>
                  <Image source={require('../../assets/images/chat-warning-3d.png')} style={s.warningImage} />
                  <View style={s.aiCopy}>
                    <Text style={s.aiTitle}>개인 연락처 교환은 주의해 주세요</Text>
                    <Text style={s.aiText}>
                      외부 채널로 유도하는 사기가 있으니 채팅에서 대화를 진행해 주세요.
                    </Text>
                    <Text style={s.aiMeta}>AI 실시간 감지 · 자동 안내</Text>
                  </View>
                </View>
              )}
            </View>
          ))}
          {requestState === 'rejected' && (
            <View style={s.closed}>
              <Text style={s.closedText}>채팅 요청이 거절됐어요.</Text>
            </View>
          )}
        </ScrollView>
        <View style={s.composer}>
          {isOwner && requestState === 'accepted' && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.quickRow}>
              {quick.map((item) => (
                <Pressable key={item} onPress={() => send(item)} style={s.quick}>
                  <Text style={s.quickText}>{item}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
          <View style={s.inputRow}>
            <TextInput
              value={text}
              onChangeText={setText}
              editable={requestState === 'accepted'}
              placeholder={
                requestState === 'pending'
                  ? isOwner
                    ? '요청을 수락하면 대화를 시작할 수 있어요'
                    : '상대방의 수락을 기다리고 있어요'
                  : requestState === 'left'
                    ? '종료된 채팅방입니다'
                    : '대화를 입력하세요'
              }
              placeholderTextColor={colors.gray400}
              style={s.input}
            />
            <Pressable
              onPress={() => send()}
              disabled={requestState !== 'accepted'}
              style={[s.send, requestState !== 'accepted' && s.sendDisabled]}
            >
              <Ionicons name="arrow-up" size={21} color={colors.dark} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  screen: { flex: 1 },
  header: {
    height: 72,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
    paddingHorizontal: spacing.x2,
  },
  back: { width: layout.minTouch, height: layout.minTouch, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1 },
  headerTitle: { ...type.title, color: colors.dark },
  headerMeta: { ...type.caption, color: colors.gray400 },
  messages: { flexGrow: 1, padding: layout.gutter, gap: spacing.x4 },
  requestCard: {
    padding: spacing.x4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gray200,
    backgroundColor: colors.white,
  },
  requestTitle: { ...type.title, color: colors.dark },
  requestText: { ...type.small, color: colors.gray600, marginTop: spacing.x2 },
  requestActions: { flexDirection: 'row', gap: spacing.x2, marginTop: spacing.x4 },
  requestButton: {
    flex: 1,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  darkButton: { backgroundColor: colors.dark },
  grayButton: { backgroundColor: colors.gray100 },
  limeButton: { backgroundColor: colors.lime },
  darkText: { ...type.label, color: colors.white },
  grayText: { ...type.label, color: colors.gray600 },
  limeText: { ...type.label, color: colors.dark, fontWeight: '600' },
  endedCard: {
    padding: spacing.x4,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
  },
  endedTitle: { ...type.title, color: colors.dark },
  endedDescription: { ...type.caption, color: colors.gray400, marginTop: spacing.x2 },
  empty: { flex: 1, alignItems: 'center', paddingTop: 160 },
  emptyTitle: { ...type.title, color: colors.gray400 },
  emptyText: { ...type.small, color: colors.gray400, textAlign: 'center', marginTop: spacing.x2 },
  messageLine: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.x2 },
  messageLineMe: { justifyContent: 'flex-end' },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: colors.lime,
    backgroundColor: colors.white,
  },
  bubble: {
    maxWidth: '72%',
    minWidth: 116,
    paddingHorizontal: spacing.x4,
    paddingVertical: spacing.x3,
    borderRadius: radius.lg,
  },
  themBubble: { backgroundColor: '#D8EB6A' },
  meBubble: { backgroundColor: colors.gray100 },
  messageText: { ...type.body, color: colors.dark },
  time: { ...type.caption, fontSize: 10, color: colors.gray400 },
  aiWarning: {
    marginHorizontal: 20,
    marginTop: spacing.x3,
    padding: spacing.x4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E6C36A',
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    shadowColor: colors.dark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  warningImage: { width: 92, height: 92, resizeMode: 'contain' },
  aiCopy: { alignItems: 'center' },
  aiTitle: { ...type.label, color: colors.dark, fontWeight: '600', marginTop: spacing.x2 },
  aiText: { ...type.caption, color: colors.gray600, textAlign: 'center', marginTop: spacing.x1 },
  aiMeta: { ...type.caption, fontSize: 10, color: colors.gray400, marginTop: spacing.x1 },
  closed: { alignItems: 'center', padding: spacing.x4 },
  closedText: { ...type.small, color: colors.gray600 },
  composer: {
    padding: spacing.x3,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
    backgroundColor: colors.white,
  },
  quickRow: { gap: spacing.x2 },
  quick: {
    height: 36,
    paddingHorizontal: spacing.x3,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.pill,
  },
  quickText: { ...type.caption, color: colors.dark },
  inputRow: { flexDirection: 'row', gap: spacing.x2, marginTop: spacing.x2 },
  input: {
    flex: 1,
    height: 48,
    paddingHorizontal: spacing.x4,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.pill,
    ...type.body,
    color: colors.dark,
  },
  send: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#AEC64D',
    backgroundColor: '#F6FBE6',
  },
  sendDisabled: { opacity: 0.4 },
});
