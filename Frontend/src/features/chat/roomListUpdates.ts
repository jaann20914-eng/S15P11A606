import type {
  ChatPinListItem,
  ChatRoomListItem,
  ChatRoomStatus,
  ChatRoomSummaryStatus,
} from '@/types/chat';
import type { UserChatEvent } from '@/types/chatSocket';

/**
 * 사용자 전용 이벤트를 목록에 반영한다.
 *
 * 목록을 다시 불러오지 않고 바뀐 줄만 고친다. 새 메시지가 올 때마다 전체를 다시 받으면 스크롤이
 * 튀고, 여러 방에서 대화가 오갈 때 요청이 몰린다.
 *
 * 목록에 없는 방의 이벤트는 그대로 흘려보낸다(같은 배열을 돌려준다). 지금 보고 있는 목록과
 * 상관없는 방일 수 있고, 정말 새 방이면 `needsReload`가 참인 이벤트로 따로 알려 온다.
 */
export function applyUserChatEvent(
  rooms: ChatRoomListItem[],
  event: UserChatEvent,
): ChatRoomListItem[] {
  if (event.eventType === 'CHAT_ROOM_UPDATED') {
    const { roomId, lastMessage, lastMessageAt } = event.data;

    /*
      안 읽음은 **항상 켠다.** 이 이벤트에는 안 읽음 여부가 담겨 오지 않는다 — 서버는 이번
      메시지를 보내지 않은 쪽에게만 보내므로, 받았다는 것 자체가 "상대가 보낸 새 메시지가 있다"는
      뜻이다.

      전에는 오지 않는 `hasUnread`를 그대로 담아 `undefined`로 덮어써서, 이벤트가 도착할 때마다
      오히려 점이 꺼졌다(2026-08-05).
    */
    return sortByRecent(
      replace(rooms, roomId, (room) => ({
        ...room,
        lastMessage,
        lastMessageAt,
        hasUnread: true,
      })),
    );
  }

  if (event.eventType === 'CHAT_ROOM_STATUS_CHANGED') {
    const { roomId, status } = event.data;

    /*
      목록은 상태를 세 가지로 줄여서 갖는다. 이벤트는 네 가지를 그대로 주므로 같은 기준으로
      바꿔 담는다 — 거절과 나감은 목록에서 구분하지 않는다.
    */
    return replace(rooms, roomId, (room) => ({ ...room, status: toSummaryStatus(status) }));
  }

  return rooms;
}

/**
 * 목록을 다시 받아야 하는 이벤트인지.
 *
 * 새 요청은 목록에 없는 방이라 고칠 대상이 없다. 이벤트에 담긴 값만으로 줄을 만들 수도 있지만
 * 뷰 온도처럼 빠진 항목이 있어 목록의 다른 줄과 모양이 달라진다. 한 번 다시 받는 편이 낫다.
 */
export function needsReload(event: UserChatEvent): boolean {
  return event.eventType === 'CHAT_ROOM_REQUESTED';
}

/**
 * 게시글 목록에 새 메시지를 반영한다.
 *
 * 요청받은 대화 탭은 방이 아니라 **글**로 묶여 있어 방 목록과 같은 손질을 쓸 수 없다. 이벤트에
 * 담긴 `pinId`로 줄을 찾아 점만 켠다 — 이 목록은 마지막 메시지를 보여주지 않는다.
 *
 * 전에는 이 목록이 새 메시지 이벤트를 아예 무시해서, 요청받은 쪽에서 대화가 와도 아무 표시가
 * 없었다(2026-08-05).
 */
export function applyUserChatEventToPins(
  pins: ChatPinListItem[],
  event: UserChatEvent,
): ChatPinListItem[] {
  if (event.eventType !== 'CHAT_ROOM_UPDATED') return pins;

  const { pinId } = event.data;

  if (!pins.some((pin) => pin.pinId === pinId && !pin.hasUnread)) return pins;

  return pins.map((pin) => (pin.pinId === pinId ? { ...pin, hasUnread: true } : pin));
}

function replace(
  rooms: ChatRoomListItem[],
  roomId: number,
  update: (room: ChatRoomListItem) => ChatRoomListItem,
): ChatRoomListItem[] {
  if (!rooms.some((room) => room.roomId === roomId)) return rooms;

  return rooms.map((room) => (room.roomId === roomId ? update(room) : room));
}

/** 최근 메시지가 위로. 메시지가 없는 방은 아래로 내린다. */
function sortByRecent(rooms: ChatRoomListItem[]): ChatRoomListItem[] {
  return [...rooms].sort((left, right) => {
    if (left.lastMessageAt === null) return 1;
    if (right.lastMessageAt === null) return -1;

    return right.lastMessageAt.localeCompare(left.lastMessageAt);
  });
}

/**
 * 방 상태를 목록이 쓰는 세 가지로 줄인다.
 *
 * 목록 조회는 서버가 이미 줄여서 주지만(`ChatRoomSummaryStatus`), 실시간 이벤트는 네 가지를
 * 그대로 준다. 한쪽만 네 가지면 같은 방의 상태가 새로고침 전후로 달라 보인다.
 */
function toSummaryStatus(status: ChatRoomStatus): ChatRoomSummaryStatus {
  if (status === 'PENDING') return 'PENDING';
  if (status === 'ACTIVE') return 'ACTIVE';

  return 'CLOSED';
}
