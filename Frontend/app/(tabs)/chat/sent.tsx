import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ScreenHeader } from '@/components/common';
import { colors } from '@/constants/theme';
import { ChatListState } from '@/features/chat/components/ChatListState';
import { ChatPinRow } from '@/features/chat/components/ChatPinRow';
import { ChatRoomRow } from '@/features/chat/components/ChatRoomRow';
import { useChatDecision, usePinLeave } from '@/features/chat/hooks/useChatDecision';
import { useChatPins, useMyChatRooms, usePinChatRooms } from '@/features/chat/hooks/useChatLists';
import { chatListStyles as s } from '@/features/chat/styles';
import type { ChatPinListItem, ChatRoomListItem } from '@/types/chat';
import { formatTimeOfDay } from '@/utils/datetime';

type Tab = '요청한 대화' | '요청받은 대화';

const TABS: Tab[] = ['요청한 대화', '요청받은 대화'];

/**
 * 채팅 목록 화면.
 *
 * 세 목록이 한 화면에 있다.
 * - 요청한 대화: 내가 남의 글에 요청해 만들어진 방들(`GET /chat/rooms`)
 * - 요청받은 대화: 요청이 온 내 게시글(`GET /chat/pins`) → 고르면 그 글의 방들(`GET /chat/rooms/{pinId}`)
 *
 * 받은 요청을 게시글로 한 번 묶는 이유는, 방만 늘어놓으면 어느 글 이야기인지 알 수 없기
 * 때문이다. 수락 · 거절과 "떠났어요"도 글 단위로 판단하는 일이라 그 화면에 둔다.
 *
 * 라우트가 `sent`와 `received` 둘이지만 화면은 하나다(`received.tsx`가 이 파일을 내보낸다).
 * 탭 전환이 곧 목록 전환이라 화면을 갈라 둘 이유가 없다.
 */
export default function Chat() {
  const [tab, setTab] = useState<Tab>('요청한 대화');
  const [query, setQuery] = useState('');
  const [selectedPin, setSelectedPin] = useState<ChatPinListItem | null>(null);

  const myRooms = useMyChatRooms();
  const pins = useChatPins();
  const pinRooms = usePinChatRooms(selectedPin?.pinId ?? null);

  const decision = useChatDecision(pinRooms.reload);
  const leave = usePinLeave(selectedPin?.pinId ?? null, pinRooms.reload);

  // 처리 결과는 그 자리에서 알린다. 목록만 조용히 바뀌면 눌린 것인지 알 수 없다.
  useEffect(() => {
    if (decision.error === null) return;

    Alert.alert('요청을 처리하지 못했어요', decision.error, [
      { text: '확인', onPress: decision.dismissError },
    ]);
  }, [decision.error, decision.dismissError]);

  useEffect(() => {
    if (leave.error === null) return;

    Alert.alert('채팅방을 종료하지 못했어요', leave.error, [
      { text: '확인', onPress: leave.dismissError },
    ]);
  }, [leave.error, leave.dismissError]);

  const filteredMyRooms = useMemo(() => filterRooms(myRooms.items, query), [myRooms.items, query]);
  const filteredPinRooms = useMemo(
    () => filterRooms(pinRooms.items, query),
    [pinRooms.items, query],
  );
  const filteredPins = useMemo(
    () => pins.items.filter((pin) => `${pin.placeName}${pin.placeAddress}`.includes(query)),
    [pins.items, query],
  );

  const openRoom = (room: ChatRoomListItem) => {
    router.push({
      pathname: '/chat-room/[roomId]',
      params: { roomId: String(room.roomId), role: selectedPin ? 'owner' : 'requester' },
    });
  };

  const confirmLeave = () => {
    Alert.alert(
      '이 게시글의 대화를 모두 끝낼까요?',
      '연결된 채팅방이 모두 종료돼요. 지난 대화는 그대로 남습니다.',
      [
        { text: '취소', style: 'cancel' },
        { text: '떠났어요', style: 'destructive', onPress: leave.leave },
      ],
    );
  };

  /** 게시글을 고른 상태에서는 그 글의 방 목록만 보여준다. */
  const inPin = selectedPin !== null;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={s.safe}>
      <View style={s.screen}>
        {/*
          목록에서는 아래에 탭 줄이 이어지므로 구분선을 겹치지 않는다.
          게시글 하나를 고른 화면에서는 탭이 사라지므로 구분선을 그린다.
        */}
        <ScreenHeader
          title={inPin ? selectedPin.placeName : '채팅방'}
          back={inPin}
          onBack={() => setSelectedPin(null)}
          divider={inPin}
        />

        {!inPin && (
          <View style={s.tabs}>
            {TABS.map((item) => (
              <Pressable
                key={item}
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === item }}
                onPress={() => {
                  setTab(item);
                  setQuery('');
                }}
                style={s.tab}
              >
                <Text style={[s.tabText, tab === item && s.tabTextActive]}>{item}</Text>
                <View style={[s.tabLine, tab === item && s.tabLineActive]} />
              </Pressable>
            ))}
          </View>
        )}

        <View style={s.search}>
          <Ionicons name="search" size={21} color={colors.gray400} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="장소나 닉네임을 검색하세요"
            placeholderTextColor={colors.gray400}
            style={s.input}
          />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.list}>
          {inPin ? (
            <>
              <ChatListState
                loading={pinRooms.loading}
                error={pinRooms.error}
                isEmpty={filteredPinRooms.length === 0}
                emptyText={
                  query === '' ? '아직 이 게시글에 온 대화가 없어요' : '검색 결과가 없어요'
                }
                onRetry={pinRooms.reload}
              />

              {filteredPinRooms.map((room) => (
                <ChatRoomRow
                  key={room.roomId}
                  room={room}
                  decidable
                  busy={decision.busyRoomId === room.roomId}
                  onOpen={() => openRoom(room)}
                  onDecide={(value) => decision.decide(room.roomId, value)}
                />
              ))}
            </>
          ) : tab === '요청한 대화' ? (
            <>
              <ChatListState
                loading={myRooms.loading}
                error={myRooms.error}
                isEmpty={filteredMyRooms.length === 0}
                emptyText={query === '' ? '아직 요청한 대화가 없어요' : '검색 결과가 없어요'}
                onRetry={myRooms.reload}
              />

              {filteredMyRooms.map((room) => (
                <ChatRoomRow key={room.roomId} room={room} onOpen={() => openRoom(room)} />
              ))}
            </>
          ) : (
            <>
              <ChatListState
                loading={pins.loading}
                error={pins.error}
                isEmpty={filteredPins.length === 0}
                emptyText={query === '' ? '아직 요청받은 대화가 없어요' : '검색 결과가 없어요'}
                onRetry={pins.reload}
              />

              {filteredPins.map((pin) => (
                <ChatPinRow
                  key={pin.pinId}
                  pin={pin}
                  onOpen={() => {
                    setSelectedPin(pin);
                    setQuery('');
                  }}
                />
              ))}
            </>
          )}
        </ScrollView>

        {/*
          이미 전부 끝난 게시글에는 버튼을 두지 않는다. 눌러도 바뀔 것이 없고, 서버도 빈 결과로
          성공을 돌려주므로 아무 일도 일어나지 않은 것처럼 보인다.
        */}
        {inPin && pinRooms.items.some((room) => room.status !== 'LEFT') && (
          <View style={s.leaveArea}>
            <Text style={s.leaveHint}>모든 답변을 종료합니다</Text>
            <Pressable
              accessibilityRole="button"
              disabled={leave.busy}
              onPress={confirmLeave}
              style={[s.leaveButton, leave.busy && s.leaveButtonBusy]}
            >
              <Text style={s.leaveText}>떠났어요</Text>
            </Pressable>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

/** 장소와 상대 닉네임으로 걸러낸다. 서버에 다시 묻지 않는다. */
function filterRooms(rooms: ChatRoomListItem[], query: string): ChatRoomListItem[] {
  if (query === '') return rooms;

  return rooms.filter((room) => `${room.placeName}${room.otherUserNickname}`.includes(query));
}
