import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ConfirmModal, NoticeModal, ScreenHeader, useNotice } from '@/components/common';
import { colors } from '@/constants/theme';
import { ChatListState } from '@/features/chat/components/ChatListState';
import { ChatPinRow } from '@/features/chat/components/ChatPinRow';
import { ChatRoomRow } from '@/features/chat/components/ChatRoomRow';
import { useChatDecision, usePinLeave } from '@/features/chat/hooks/useChatDecision';
import { useChatPins, useMyChatRooms, usePinChatRooms } from '@/features/chat/hooks/useChatLists';
import { chatListStyles as s } from '@/features/chat/styles';
import { consumeReceivedPinFocus } from '@/features/chat/receivedFocus';
import { isPinLeft } from '@/store/leftPins';
import type { ChatPinListItem, ChatRoomListItem } from '@/types/chat';
import type { PinId } from '@/types/pin';
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
  /*
    어느 탭으로 열릴지는 경로가 정한다.

    화면은 하나지만 라우트가 둘이라, 들어온 경로가 곧 "무엇을 보러 왔는지"다. 내 게시글에 온
    요청을 보러 `/chat/received`로 왔는데 요청한 대화가 먼저 열리면, 왜 빈 목록이 보이는지
    알 수 없다(핀 상세의 "채팅방으로 이동"이 그랬다).
  */
  const pathname = usePathname();
  const [tab, setTab] = useState<Tab>(pathname.endsWith('/received') ? '요청받은 대화' : '요청한 대화');
  const [query, setQuery] = useState('');
  const [selectedPin, setSelectedPin] = useState<ChatPinListItem | null>(null);

  const myRooms = useMyChatRooms();
  const pins = useChatPins();
  const pinRooms = usePinChatRooms(selectedPin?.pinId ?? null);

  /*
    핀 상세의 "채팅방으로 이동"이 남긴 핀. 목록에서 그 글을 찾는 대로 방 목록까지 바로 연다.

    초점을 받을 때 꺼낸다(꺼내면 사라진다 — `receivedFocus.ts`). 목록이 아직 그 글을 모르면
    (방금 첫 요청이 온 경우) 기다렸다가, 재조회가 목록을 채우는 순간 들어간다. 화면을 떠나면
    기다림도 버린다 — 다음에 탭으로 열 때 끌려 들어가면 안 된다.
  */
  const [pendingPinId, setPendingPinId] = useState<PinId | null>(null);

  useFocusEffect(
    useCallback(() => {
      const requested = consumeReceivedPinFocus();

      if (requested !== null) {
        setTab('요청받은 대화');
        setSelectedPin(null);
        setQuery('');
        setPendingPinId(requested);
      }

      return () => setPendingPinId(null);
    }, []),
  );

  useEffect(() => {
    if (pendingPinId === null) return;

    const target = pins.items.find((pin) => pin.pinId === pendingPinId);

    if (target === undefined) return;

    setSelectedPin(target);
    setPendingPinId(null);
  }, [pendingPinId, pins.items]);

  /*
    수락·거절·떠났어요 뒤에는 방 목록과 함께 **글 목록도** 다시 받는다. 글 줄의 점은 대기 중인
    요청이 있는지로 계산하는데, 방 목록만 새로 받으면 방금 처리한 요청이 글 줄에는 남는다.
  */
  const reloadBothLists = () => {
    pinRooms.reload();
    pins.reload();
  };

  const decision = useChatDecision(reloadBothLists);
  const leave = usePinLeave(selectedPin?.pinId ?? null, reloadBothLists);

  // 처리 결과는 그 자리에서 알린다. 목록만 조용히 바뀌면 눌린 것인지 알 수 없다.
  const { notice, showNotice, confirmNotice } = useNotice();

  useEffect(() => {
    if (decision.error === null) return;

    showNotice({
      title: '요청을 처리하지 못했어요',
      message: decision.error,
      onConfirm: decision.dismissError,
    });
  }, [decision.error, decision.dismissError, showNotice]);

  useEffect(() => {
    if (leave.error === null) return;

    showNotice({
      title: '채팅방을 종료하지 못했어요',
      message: leave.error,
      onConfirm: leave.dismissError,
    });
  }, [leave.error, leave.dismissError, showNotice]);

  const filteredMyRooms = useMemo(() => filterRooms(myRooms.items, query), [myRooms.items, query]);
  const filteredPinRooms = useMemo(() => filterRooms(pinRooms.items, query), [pinRooms.items, query]);
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

  /** 되돌릴 수 없는 동작이라 확인 모달을 한 번 세운다(`ConfirmModal`). */
  const [leaveAsked, setLeaveAsked] = useState(false);

  /*
    탭별 안 읽음 표시. 목록 줄의 점과 같은 재료로 계산하므로 늘 함께 켜지고 함께 꺼진다 —
    그 목록의 안 읽음을 전부 읽어야만 탭의 점도 사라진다.

    두 목록 훅은 어느 탭이 보이든 살아서 소켓 이벤트를 받고 있어, 반대쪽 탭에 일이 생겨도
    이 점이 바로 켜진다. 지금 보고 있는 탭에도 그대로 붙는다 — 목록을 스크롤로 훑는 중에
    위쪽 줄의 점을 지나쳤을 수 있다.
  */
  const unreadByTab: Record<Tab, boolean> = {
    '요청한 대화': myRooms.items.some((room) => room.hasUnread),
    '요청받은 대화': pins.items.some((pin) => pin.hasUnread),
  };

  /** 게시글을 고른 상태에서는 그 글의 방 목록만 보여준다. */
  const inPin = selectedPin !== null;
  /*
    떠났어요 버튼을 잠그는 기준. **떠났어요를 실제로 누른 글**만 잠근다.

    "방이 전부 CLOSED"로 판정했더니 유일한 요청 하나를 거절만 해도 화면이 "모든 대화가
    종료됐어요"로 잠겼다(2026-08-05) — 목록 계약이 거절(REFUSED)과 떠남(LEFT)을 CLOSED
    하나로 합쳐 줘서 방 상태로는 구분할 수 없다. 거절한 글은 새 요청을 계속 받는 살아 있는
    글이라 떠났어요도 여전히 누를 수 있어야 한다.

    근거는 서버의 제보자 상태(`publisherStatus`, 2026-08-06 추가)다. 세션 기억
    (`store/leftPins`)은 배포 전 서버와 떠난 직후 재조회 전의 빈틈을 받친다 —
    `selectedPin`은 고른 순간의 값이라 떠난 직후의 서버 값을 스스로 모른다.
  */
  const pinLeft =
    selectedPin !== null && (selectedPin.publisherStatus === 'LEFT' || isPinLeft(selectedPin.pinId));

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
                <View style={s.tabLabel}>
                  <Text style={[s.tabText, tab === item && s.tabTextActive]}>{item}</Text>
                  {unreadByTab[item] && <View style={s.tabUnread} />}
                </View>
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
                emptyText={query === '' ? '아직 이 핀에 온 대화가 없어요' : '검색 결과가 없어요'}
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
          이미 전부 끝난 게시글에서는 버튼을 지우지 않고 **잠근다**. 버튼이 사라지면 원래 없던
          것인지 처리된 것인지 알 수 없는데, 잠긴 채 남아 있으면 "이미 눌렀다"로 읽힌다.
        */}
        {inPin && pinRooms.items.length > 0 && (
          <View style={s.leaveArea}>
            <Text style={s.leaveHint}>{pinLeft ? '모든 대화가 종료됐어요' : '모든 답변을 종료합니다'}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: pinLeft }}
              disabled={leave.busy || pinLeft}
              onPress={() => setLeaveAsked(true)}
              style={[s.leaveButton, leave.busy && s.leaveButtonBusy, pinLeft && s.leaveButtonDone]}
            >
              <Text style={[s.leaveText, pinLeft && s.leaveTextDone]}>떠났어요</Text>
            </Pressable>
          </View>
        )}
      </View>

      <ConfirmModal
        visible={leaveAsked}
        title="이 핀의 대화를 모두 끝낼까요?"
        message={'연결된 채팅방이 모두 종료돼요.\n지난 대화는 그대로 남습니다.'}
        confirmLabel="떠났어요"
        busy={leave.busy}
        onCancel={() => setLeaveAsked(false)}
        onConfirm={() => {
          setLeaveAsked(false);
          leave.leave();
        }}
      />

      <NoticeModal
        visible={notice !== null}
        title={notice?.title ?? ''}
        message={notice?.message ?? ''}
        onConfirm={confirmNotice}
      />
    </SafeAreaView>
  );
}

/** 장소와 상대 닉네임으로 걸러낸다. 서버에 다시 묻지 않는다. */
function filterRooms(rooms: ChatRoomListItem[], query: string): ChatRoomListItem[] {
  if (query === '') return rooms;

  return rooms.filter((room) => `${room.placeName}${room.otherUserNickname}`.includes(query));
}
