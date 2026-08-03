import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { ViewAvatar } from '@/components/common';
import { colors } from '@/constants/theme';
import type { ChatDecision, ChatRoomListItem, ChatRoomStatus } from '@/types/chat';
import { formatTimeOfDay } from '@/utils/datetime';
import { AVATAR_SIZE, chatListStyles as s } from '../styles';

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
 * - 마지막 줄의 높이도 늘 잡아 둔다(시각이 없는 방은 그 자리를 비워 둔다)
 * - 수락 · 거절은 마지막 줄에서 시각 오른쪽에 놓고, 그 줄 높이를 버튼 높이로 잡아 둔다.
 *   버튼이 없는 줄도 같은 높이라 대기 중인 줄만 높아지지 않는다
 */
export function ChatRoomRow({
  room,
  decidable = false,
  busy = false,
  onOpen,
  onDecide,
}: ChatRoomRowProps) {
  const showDecisions = decidable && room.status === 'PENDING';
  /** 아직 주고받은 말이 없는 방. 안내 문구가 한 줄이라 아래 간격을 다르게 잡는다. */
  const empty = room.lastMessage === null;

  return (
    <Pressable accessibilityRole="button" onPress={onOpen} style={s.chatRow}>
      <ViewAvatar angle={room.otherUserViewTemperature} size={AVATAR_SIZE} />

      <View style={s.chatRowCopy}>
        <View style={s.rowTitleLine}>
          <Text numberOfLines={1} style={s.rowTitle}>
            {room.placeName} · {room.otherUserNickname}
          </Text>
          {/*
            수락 · 거절이 붙는 줄에는 상태 글자를 두지 않는다.

            버튼이 있다는 것 자체가 "아직 답하지 않았다"는 뜻이라 `대기중`은 같은 말을 두 번 하는
            셈이다. 게다가 제목(장소 · 닉네임)이 길 때 그 글자가 폭을 먹어 이름이 더 잘린다.

            버튼이 없는 곳에서는 그대로 보여준다. 요청한 대화 탭의 `대기중`은 상대의 응답을
            기다리는 상태이고 내가 할 일이 없어서, 글자로 알려 주지 않으면 알 방법이 없다.
          */}
          {!showDecisions && (
            <Text style={[s.statusText, statusStyle(room.status)]}>{labelByStatus[room.status]}</Text>
          )}
          {room.hasUnread && <View style={s.unread} />}
        </View>

        <Text numberOfLines={2} style={[s.message, empty && s.messagePlaceholder]}>
          {room.lastMessage ?? emptyMessageByStatus[room.status]}
        </Text>

        <View style={[s.timeLine, empty && s.timeLineCentered]}>
          {/*
            시각이 없으면 글자를 아예 두지 않는다.

            빈 글자를 남겨 두면 폭은 0이어도 그 뒤의 간격은 그대로 남아, 버튼만 오른쪽으로 밀려
            위 메시지의 왼쪽 끝과 어긋난다. 줄 높이는 `timeLine`이 잡아 두므로 비어도 흔들리지
            않는다.
          */}
          {room.lastMessageAt !== null && (
            <Text style={s.time}>{formatTimeOfDay(room.lastMessageAt)}</Text>
          )}

          {showDecisions && (
            <View style={s.decisions}>
              {/*
                거절을 왼쪽, 수락을 오른쪽에 둔다. 오른쪽 끝이 눌러서 넘어가는 자리라, 되돌리기
                어려운 수락을 그 자리에 둔다.

                줄 전체가 눌리는 영역 안에 있으므로 누름이 위로 새지 않게 막는다. 그러지 않으면
                수락을 눌러도 방으로 들어가 버린다.
              */}
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
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}
