import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { ViewAvatar } from '@/components/common';
import { colors } from '@/constants/theme';
import type { ChatDecision, ChatRoomListItem, ChatRoomStatus } from '@/types/chat';
import { formatTimeOfDay } from '@/utils/datetime';
import { chatListStyles as s } from '../styles';

export interface ChatRoomRowProps {
  room: ChatRoomListItem;
  /** 대기 중인 요청에 수락 · 거절을 붙일지. 내 게시글에 온 요청에서만 참이다. */
  decidable?: boolean;
  /** 이 방을 처리하는 중인지. 버튼을 잠근다. */
  busy?: boolean;
  onOpen: () => void;
  onDecide?: (decision: ChatDecision) => void;
}

/** 상태별 표시 문구. 서버 값을 그대로 보여주지 않는다. */
const labelByStatus: Record<ChatRoomStatus, string> = {
  PENDING: '대기중',
  ACTIVE: '채팅중',
  REFUSED: '거절됨',
  LEFT: '종료',
};

/** 마지막 메시지가 없을 때 그 자리에 놓는 문구. 빈 줄로 두면 줄 높이가 흔들린다. */
const emptyMessageByStatus: Record<ChatRoomStatus, string> = {
  PENDING: '아직 대화가 시작되지 않았어요',
  ACTIVE: '대화가 진행 중이에요',
  REFUSED: '거절된 요청이에요',
  LEFT: '종료된 대화예요',
};

function statusStyle(status: ChatRoomStatus) {
  if (status === 'PENDING') return s.pending;
  if (status === 'ACTIVE') return s.active;

  return s.ended;
}

/**
 * 채팅방 한 줄.
 *
 * 요청한 대화와 요청받은 대화가 같은 모양을 쓴다. 다른 점은 대기 중일 때 수락 · 거절이 붙는지
 * 하나뿐이고, 그건 내 게시글에 온 요청에서만 할 수 있다.
 *
 * **모든 줄의 높이가 같다.** 내용에 따라 높이가 달라지면 목록이 들쭉날쭉해 보이고, 스크롤할 때
 * 어디까지 봤는지 가늠하기 어렵다. 그래서
 * - 메시지 자리는 늘 두 줄만큼 잡아 둔다(한 줄짜리도 같은 높이)
 * - 시각 자리도 늘 잡아 둔다(메시지가 없는 방은 비워 둔다)
 * - 수락 · 거절은 아래가 아니라 **오른쪽**에 세워 둔다. 아래에 붙이면 그 줄만 높아진다
 */
export function ChatRoomRow({
  room,
  decidable = false,
  busy = false,
  onOpen,
  onDecide,
}: ChatRoomRowProps) {
  const showDecisions = decidable && room.status === 'PENDING';

  return (
    <Pressable accessibilityRole="button" onPress={onOpen} style={s.chatRow}>
      <ViewAvatar angle={room.otherUserViewTemperature} size={36} />

      <View style={s.chatRowCopy}>
        <View style={s.rowTitleLine}>
          <Text numberOfLines={1} style={s.rowTitle}>
            {room.placeName} · {room.otherUserNickname}
          </Text>
          <Text style={[s.statusText, statusStyle(room.status)]}>{labelByStatus[room.status]}</Text>
          {room.hasUnread && <View style={s.unread} />}
        </View>

        <Text
          numberOfLines={2}
          style={[s.message, room.lastMessage === null && s.messagePlaceholder]}
        >
          {room.lastMessage ?? emptyMessageByStatus[room.status]}
        </Text>

        <Text style={s.time}>
          {room.lastMessageAt === null ? '' : formatTimeOfDay(room.lastMessageAt)}
        </Text>
      </View>

      {showDecisions && (
        <View style={s.decisions}>
          {/*
            같은 줄 안에 있으므로 누름이 위로 새지 않게 막는다. 그러지 않으면 수락을 눌러도
            방으로 들어가 버린다.
          */}
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={(event) => {
              event.stopPropagation();
              onDecide?.('ACCEPT');
            }}
            style={[s.decision, s.accept, busy && s.busy]}
          >
            {busy ? (
              <ActivityIndicator color={colors.dark} size="small" />
            ) : (
              <Text style={s.acceptText}>수락</Text>
            )}
          </Pressable>

          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={(event) => {
              event.stopPropagation();
              onDecide?.('REJECT');
            }}
            style={[s.decision, s.reject, busy && s.busy]}
          >
            <Text style={s.rejectText}>거절</Text>
          </Pressable>
        </View>
      )}
    </Pressable>
  );
}
