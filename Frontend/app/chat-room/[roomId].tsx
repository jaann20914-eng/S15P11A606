import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ViewAvatar } from '@/components/common';
import { colors, layout, radius, spacing, type } from '@/constants/theme';
import { useChatDecision } from '@/features/chat/hooks/useChatDecision';
import { useChatRoom } from '@/features/chat/hooks/useChatRoom';
import { useChatSocket } from '@/features/chat/hooks/useChatSocket';
import { useKeyboardOverlap } from '@/hooks/useKeyboardOverlap';
import type { ChatRoomStatus, ChatWarning } from '@/types/chat';
import { splitAddress } from '@/utils/address';
import { formatTimeOfDay } from '@/utils/datetime';

/** 대화를 시작하기 전에 눌러 보낼 수 있는 흔한 질문. 첫 마디의 부담을 덜어 준다. */
const quickMessages = ['좌석 남아있나요?', '지금 웨이팅 얼마나 돼요?', '주차되나요?'];

/** 지난 경고 안내가 떠 있는 시간. 읽고 사라질 만큼만 둔다. */
const TOAST_MS = 5000;

/** 보낼 수 없는 상태에서 입력칸에 놓는 안내. 왜 못 쓰는지 그 자리에서 알려 준다. */
function placeholderByStatus(status: ChatRoomStatus, isOwner: boolean): string {
  if (status === 'PENDING') {
    return isOwner ? '요청을 수락하면 대화를 시작할 수 있어요' : '상대방의 수락을 기다리고 있어요';
  }
  if (status === 'REFUSED') return '거절된 요청이에요';
  if (status === 'LEFT') return '종료된 채팅방이에요';

  return '대화를 입력하세요';
}

/**
 * 채팅방 화면.
 *
 * 이력은 REST로 한 번 받고(`GET /chat/rooms/{roomId}/messages`) 그 뒤로는 소켓 이벤트로 이어
 * 간다. 보낸 메시지도 서버가 되돌려 줄 때 화면에 붙는다 — 이유는 `useChatRoom`에 적어 두었다.
 *
 * `role`은 목록에서 넘겨준다. 내 게시글에 온 요청이면 `owner`다. 대기 중일 때 안내 문구를
 * 고르는 데만 쓰고, 무엇을 할 수 있는지는 서버가 준 상태로 판단한다.
 */
export default function Room() {
  const { roomId: roomIdParam, role } = useLocalSearchParams<{ roomId: string; role?: string }>();
  const roomId = Number(roomIdParam);
  const isOwner = role === 'owner';

  // 방에 있는 동안 연결을 붙잡는다. 탭 레이아웃도 붙잡고 있어 실제 연결은 하나다.
  useChatSocket();

  const room = useChatRoom(Number.isNaN(roomId) ? null : roomId);
  const [text, setText] = useState('');

  const status = room.info?.status ?? null;

  /*
    작성자는 수락하기 전에 보낼 수 없다. 수락 전(`PENDING`)에 보낼 수 있는 쪽은 요청자뿐인데
    (서버 정책), `canSend`는 방 상태만 보므로 여기서 역할을 겹쳐 잠근다. 입력칸은 종료된
    방과 같은 회색 잠금으로 보이고, 안내 문구가 수락부터 하라고 알려 준다.
  */
  const canWrite = room.canSend && !(isOwner && status === 'PENDING');
  const sendable = canWrite && text.trim().length > 0;

  /*
    방 안에서도 수락 · 거절할 수 있게 한다. 요청 카드에서 대화 내용을 읽고 나면 답하고 싶은
    자리가 바로 여기인데, 목록으로 돌아가야만 답할 수 있으면 두 번 오가게 된다.
    처리 후에는 이력을 다시 받아 상태(요청 카드 → 대화)를 맞춘다. 목록은 화면으로 돌아갈 때
    스스로 다시 받는다.
  */
  const decision = useChatDecision(room.reload);

  useEffect(() => {
    if (decision.error === null) return;

    Alert.alert('요청을 처리하지 못했어요', decision.error, [
      { text: '확인', onPress: decision.dismissError },
    ]);
  }, [decision.error, decision.dismissError]);

  /*
    키보드가 덮는 만큼 화면을 접는다.

    `KeyboardAvoidingView`는 안드로이드에서 창이 줄어드는 것에 기대는데, 이 앱은 화면 끝까지
    그리는 방식이라 창이 줄지 않는다 — 키보드가 입력칸을 그대로 덮어 무엇을 쓰는지 보이지
    않았다. 등록 화면과 같은 방식으로 겹치는 높이를 직접 재서 아래 여백으로 만든다.
  */
  const screenRef = useRef<View>(null);
  const keyboardOverlap = useKeyboardOverlap(screenRef);

  /*
    메시지 목록의 스크롤 위치.

    - 이력을 받아 처음 그릴 때는 **맨 아래**로 간다. 마지막 대화가 이어 갈 지점이다.
    - 새 메시지가 붙을 때는 바닥 근처를 보고 있을 때만 따라 내려간다. 위로 올려 지난 대화를
      읽는 중이라면 끌어내리지 않는다.
  */
  const scrollRef = useRef<ScrollView>(null);
  const nearBottomRef = useRef(true);
  const offsetYRef = useRef(0);
  const renderedOnceRef = useRef(false);

  const anchorBottom = () => scrollRef.current?.scrollToEnd({ animated: false });

  const followBottom = () => {
    if (!renderedOnceRef.current) {
      renderedOnceRef.current = true;

      /*
        처음에는 여러 번 잡는다. 이 콜백이 오는 시점에 줄 높이 계산이 다 끝나 있지 않아,
        한 번만 내리면 마지막 메시지가 반쯤 가려진 채 멈춘다. 프레임이 정리된 뒤와 그보다
        조금 뒤에 한 번씩 더 내려 마지막 줄까지 확실히 보이게 한다 — 이미 바닥이면 아무
        일도 일어나지 않는 호출이라 겹쳐도 해롭지 않다.
      */
      anchorBottom();
      requestAnimationFrame(anchorBottom);
      setTimeout(anchorBottom, 150);
      return;
    }

    if (nearBottomRef.current) scrollRef.current?.scrollToEnd({ animated: true });
  };

  const trackScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;

    offsetYRef.current = contentOffset.y;
    nearBottomRef.current = contentOffset.y + layoutMeasurement.height >= contentSize.height - 80;
  };

  /**
   * 키보드가 열려 목록이 접힐 때의 처리.
   *
   * `keyboardOverlap` 값이 바뀌는 순간이 아니라 **목록의 높이가 실제로 줄어든 뒤**(onLayout)에
   * 움직인다. 값이 바뀐 프레임에는 아직 옛 높이라, 그때 스크롤하면 접힌 만큼 다시 가려진다.
   *
   * - 바닥을 보고 있었으면 바닥을 유지한다 — 마지막 대화를 보며 입력하는 경우다.
   * - 중간을 읽고 있었으면 줄어든 만큼만 내린다. 읽던 줄이 키보드에 가려지지 않으면서,
   *   바닥까지 끌려 내려가지도 않는다.
   */
  const viewportHeightRef = useRef(0);

  const handleListLayout = (event: { nativeEvent: { layout: { height: number } } }) => {
    const { height } = event.nativeEvent.layout;
    const previous = viewportHeightRef.current;

    viewportHeightRef.current = height;

    // 처음 재는 것이거나 커진 것(키보드 내려감)은 그대로 둔다.
    if (previous === 0 || height >= previous) return;

    if (nearBottomRef.current) {
      scrollRef.current?.scrollToEnd({ animated: false });
      return;
    }

    scrollRef.current?.scrollTo({ y: offsetYRef.current + (previous - height), animated: false });
  };

  /*
    onLayout을 놓치는 첫 진입의 뒷받침.

    처음 들어와 곧바로 입력칸을 누르면, 이력이 그려지는 레이아웃과 키보드로 접히는 레이아웃이
    한 패스에 합쳐져 onLayout이 "줄어들었다"를 보지 못할 수 있다(이전 높이가 없다). 그때를
    위해 접힘 값이 생기면 두 프레임 뒤 — 접힌 레이아웃이 반영된 뒤 — 바닥을 한 번 더 잡는다.
    onLayout이 이미 처리했다면 같은 자리라 아무 일도 일어나지 않는다.

    바닥을 보고 있을 때만이다. 중간을 읽는 경우의 이동량 계산은 onLayout 쪽만 맡는다 —
    두 곳에서 옮기면 두 번 밀린다.
  */
  useEffect(() => {
    if (keyboardOverlap === 0 || !nearBottomRef.current) return;

    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: false }));
    });

    return () => cancelAnimationFrame(frame);
  }, [keyboardOverlap]);

  /*
    들어올 때마다 지난 경고를 한 번 짚어 준다.

    경고 팝업은 도착할 때 한 번 뜨고 마는데, 그것만으로는 방을 다시 열었을 때 이 대화에 경고가
    있었다는 사실이 남지 않는다. 마지막 경고만 잠깐 보여주고 스스로 사라지게 둔다 — 매번 팝업으로
    막으면 지난 대화를 다시 보는 것조차 번거로워진다.
  */
  const [toast, setToast] = useState<ChatWarning | null>(null);
  const lastWarning = room.warnings.at(-1) ?? null;

  useEffect(() => {
    if (room.loading || lastWarning === null) return;

    setToast(lastWarning);

    const timer = setTimeout(() => setToast(null), TOAST_MS);

    return () => clearTimeout(timer);
  }, [room.loading, lastWarning]);

  /** 주소 끝 괄호(법정동)는 헤더에서 떼어 낸다. 한 줄뿐이라 도로명이 먼저 보여야 한다. */
  const address = useMemo(() => (room.info === null ? null : splitAddress(room.info.address)), [room.info]);

  const send = (value: string) => {
    room.send(value);
    setText('');

    /*
      보낸 순간 바닥으로 돌아간다. 중간을 읽다가 보냈어도, 보낸 사람이 확인하고 싶은 것은
      방금 자기가 한 말이다. 지금 끝까지 내려 두면 서버가 메시지를 되돌려 붙일 때도
      "바닥을 보는 중"이라 따라 내려간다.
    */
    nearBottomRef.current = true;
    scrollRef.current?.scrollToEnd({ animated: true });
  };

  return (
    <SafeAreaView style={s.safe}>
      <View ref={screenRef} style={[s.screen, { paddingBottom: keyboardOverlap }]}>
        <View style={s.header}>
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={s.back}>
            <Ionicons name="chevron-back" size={24} color={colors.gray400} />
          </Pressable>

          {room.info !== null && <ViewAvatar angle={room.info.otherUserViewTemperature} size={36} />}

          <View style={s.headerCopy}>
            <Text numberOfLines={1} style={s.headerTitle}>
              {room.info === null ? '대화' : `${room.info.placeName} · ${room.info.otherUserNickname}`}
            </Text>
            {address !== null && (
              <Text numberOfLines={1} style={s.headerMeta}>
                {address.street}
              </Text>
            )}
          </View>
        </View>

        {room.loading ? (
          <View style={s.state}>
            <ActivityIndicator color={colors.gray400} />
            <Text style={s.stateText}>대화를 불러오고 있어요</Text>
          </View>
        ) : room.error !== null ? (
          <View style={s.state}>
            <Text style={s.stateText}>{room.error}</Text>
            <Pressable accessibilityRole="button" onPress={room.reload} style={s.retry}>
              <Text style={s.retryText}>다시 시도</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView
            ref={scrollRef}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.messages}
            onContentSizeChange={followBottom}
            onLayout={handleListLayout}
            onScroll={trackScroll}
            scrollEventThrottle={100}
          >
            {status === 'PENDING' && (
              <View style={s.requestCard}>
                <Text style={s.requestTitle}>
                  {isOwner ? '새 채팅 요청이 도착했어요' : '채팅을 요청했어요'}
                </Text>
                <Text style={s.requestText}>
                  {isOwner
                    ? '요청을 수락하면 요청자에게서 5크레딧이 차감되고 나에게 5크레딧이 적립돼요.'
                    : '먼저 궁금한 것을 남겨 두면 상대가 수락할 때 함께 전달돼요.'}
                </Text>

                {isOwner && (
                  <View style={s.requestActions}>
                    <Pressable
                      accessibilityRole="button"
                      disabled={decision.busyRoomId !== null}
                      onPress={() => decision.decide(roomId, 'REJECT')}
                      style={[
                        s.requestAction,
                        s.requestReject,
                        decision.busyRoomId !== null && s.requestBusy,
                      ]}
                    >
                      <Text style={s.requestRejectText}>거절</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      disabled={decision.busyRoomId !== null}
                      onPress={() => decision.decide(roomId, 'ACCEPT')}
                      style={[
                        s.requestAction,
                        s.requestAccept,
                        decision.busyRoomId !== null && s.requestBusy,
                      ]}
                    >
                      <Text style={s.requestAcceptText}>수락</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            )}

            {status === 'REFUSED' && (
              <View style={s.endedCard}>
                <Text style={s.endedTitle}>요청이 거절됐어요</Text>
                <Text style={s.endedDescription}>지난 대화는 그대로 남아 있어요.</Text>
              </View>
            )}

            {status === 'LEFT' && (
              <View style={s.endedCard}>
                <Text style={s.endedTitle}>종료된 대화예요</Text>
                <Text style={s.endedDescription}>
                  더 이상 메시지를 보낼 수 없어요. 지난 대화는 그대로 남아 있어요.
                </Text>
              </View>
            )}

            {room.messages.length === 0 && status === 'PENDING' && !isOwner && (
              <View style={s.empty}>
                <Text style={s.emptyTitle}>메시지를 먼저 보내보세요</Text>
                <Text style={s.emptyText}>상대방이 수락하면 대화를 이어갈 수 있어요.</Text>
              </View>
            )}

            {room.messages.map((message) => (
              <View
                key={message.messageId}
                style={[s.messageLine, message.sender === 'SELF' && s.messageLineMe]}
              >
                <View style={[s.bubble, message.sender === 'SELF' ? s.meBubble : s.themBubble]}>
                  {/* 화면에는 언제나 마스킹된 쪽을 그린다. 원본은 뒷처리용으로만 갖고 있다. */}
                  <Text style={s.messageText}>{message.maskedContent}</Text>
                </View>
                <Text style={s.time}>{formatTimeOfDay(message.createdAt)}</Text>
              </View>
            ))}
          </ScrollView>
        )}

        {/* 지난 경고 안내. 화면을 막지 않고 위에 얹혀 스스로 사라진다. */}
        {toast !== null && (
          <View style={s.toast}>
            <Ionicons name="alert-circle" size={18} color="#E6C36A" />
            <Text numberOfLines={3} style={s.toastText}>
              {toast.content}
            </Text>
          </View>
        )}

        <View style={s.composer}>
          {canWrite && room.messages.length === 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.quickRow}>
              {quickMessages.map((item) => (
                <Pressable accessibilityRole="button" key={item} onPress={() => send(item)} style={s.quick}>
                  <Text style={s.quickText}>{item}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}

          {room.sendError !== null && (
            <Pressable accessibilityRole="button" onPress={room.dismissSendError}>
              <Text style={s.sendError}>{room.sendError}</Text>
            </Pressable>
          )}

          <View style={s.inputRow}>
            {/*
              보낼 수 없는 방은 입력칸을 회색으로 채워 눌러볼 여지를 없앤다. 흰 칸에 안내만 있으면
              "지금은 안 되는 것"이 아니라 "눌러 보면 될 것"처럼 읽힌다.
            */}
            <TextInput
              value={text}
              onChangeText={setText}
              editable={canWrite}
              placeholder={status === null ? '' : placeholderByStatus(status, isOwner)}
              placeholderTextColor={colors.gray400}
              onSubmitEditing={() => send(text)}
              style={[s.input, !canWrite && s.inputDisabled]}
            />
            <Pressable
              accessibilityRole="button"
              onPress={() => send(text)}
              disabled={!sendable}
              style={[s.send, !sendable && s.sendDisabled]}
            >
              <Ionicons name="arrow-up" size={21} color={colors.dark} />
            </Pressable>
          </View>
        </View>
      </View>

      {/*
        방금 도착한 경고는 팝업으로 막아 세운다. 대화 중에 바로 알아야 하는 내용이고, 흐르는
        안내로 두면 스크롤에 밀려 못 보고 지나간다.
      */}
      <Modal
        animationType="fade"
        transparent
        visible={room.arrivedWarning !== null}
        onRequestClose={room.dismissWarning}
      >
        <View style={s.backdrop}>
          <View style={s.warningCard}>
            <Image source={require('../../assets/images/chat-warning-3d.png')} style={s.warningImage} />
            <Text style={s.warningTitle}>잠깐 확인해 주세요</Text>
            <Text style={s.warningText}>{room.arrivedWarning?.content}</Text>
            <Text style={s.warningMeta}>AI 실시간 감지 · 자동 안내</Text>

            <Pressable accessibilityRole="button" onPress={room.dismissWarning} style={s.warningButton}>
              <Text style={s.warningButtonText}>알겠어요</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
    gap: spacing.x2,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
    paddingHorizontal: spacing.x2,
  },
  back: {
    width: layout.minTouch,
    height: layout.minTouch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: { flex: 1 },
  headerTitle: { ...type.body, color: colors.dark, fontWeight: '600' },
  headerMeta: { ...type.caption, color: colors.gray400 },

  /** 불러오는 중·실패가 같은 자리를 쓴다. */
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.x3 },
  stateText: { ...type.small, textAlign: 'center', color: colors.gray400 },
  retry: {
    height: 36,
    paddingHorizontal: spacing.x4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.gray100,
  },
  retryText: { ...type.caption, color: colors.gray600, fontWeight: '600' },

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
  /** 요청 카드 안의 수락 · 거절. 목록의 버튼과 같은 순서(거절 왼쪽 · 수락 오른쪽)를 쓴다. */
  requestActions: { flexDirection: 'row', gap: spacing.x2, marginTop: spacing.x4 },
  requestAction: {
    flex: 1,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  requestAccept: { backgroundColor: colors.lime },
  requestAcceptText: { ...type.label, color: colors.dark, fontWeight: '600' },
  requestReject: { backgroundColor: colors.gray100 },
  requestRejectText: { ...type.label, color: colors.gray600, fontWeight: '600' },
  requestBusy: { opacity: 0.6 },
  endedCard: {
    padding: spacing.x4,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
  },
  endedTitle: { ...type.title, color: colors.dark },
  endedDescription: { ...type.caption, color: colors.gray400, marginTop: spacing.x2 },
  empty: { flex: 1, alignItems: 'center', paddingTop: 120 },
  emptyTitle: { ...type.title, color: colors.gray400 },
  emptyText: { ...type.small, color: colors.gray400, textAlign: 'center', marginTop: spacing.x2 },

  messageLine: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.x2 },
  messageLineMe: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '72%',
    paddingHorizontal: spacing.x4,
    paddingVertical: spacing.x3,
    borderRadius: radius.lg,
  },
  themBubble: { backgroundColor: '#D8EB6A' },
  meBubble: { backgroundColor: colors.gray100 },
  messageText: { ...type.body, color: colors.dark },
  time: { ...type.caption, fontSize: 10, color: colors.gray400 },

  /** 지난 경고 안내. 입력칸 위에 얹는다. */
  toast: {
    position: 'absolute',
    left: layout.gutter,
    right: layout.gutter,
    bottom: 104,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.x2,
    padding: spacing.x3,
    borderWidth: 1,
    borderColor: '#E6C36A',
    borderRadius: radius.md,
    backgroundColor: colors.white,
    shadowColor: colors.dark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  toastText: { ...type.caption, flex: 1, color: colors.gray600 },

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
  sendError: { ...type.caption, color: '#FF7580', marginTop: spacing.x2 },
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
  /** 보낼 수 없는 방의 입력칸. 회색으로 채워 입력할 곳이 아님을 모양으로 알린다. */
  inputDisabled: { backgroundColor: colors.gray100, borderColor: colors.gray100 },
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

  /* 방금 도착한 경고 팝업 */
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: layout.gutter,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  warningCard: {
    width: '100%',
    alignItems: 'center',
    padding: spacing.x5,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
  },
  warningImage: { width: 92, height: 92, resizeMode: 'contain' },
  warningTitle: { ...type.title, color: colors.dark, marginTop: spacing.x2 },
  warningText: { ...type.small, color: colors.gray600, textAlign: 'center', marginTop: spacing.x2 },
  warningMeta: { ...type.caption, fontSize: 10, color: colors.gray400, marginTop: spacing.x2 },
  warningButton: {
    width: '100%',
    height: 48,
    marginTop: spacing.x4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.dark,
  },
  warningButtonText: { ...type.label, color: '#D9ED76', fontWeight: '600' },
});
