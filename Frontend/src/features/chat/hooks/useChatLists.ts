import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useFocusEffect } from 'expo-router';
import { getChatPins } from '@/api/chat/pins';
import { getChatRooms, getPinChatRooms } from '@/api/chat/rooms';
import type { ChatPinListItem, ChatRoomListItem } from '@/types/chat';
import type { PinId } from '@/types/pin';
import { applyUserChatEvent, applyUserChatEventToPins, needsReload } from '../roomListUpdates';
import { onRoomRead } from '../readTracker';
import { useUserChatEvents } from './useChatEvents';

/** 목록 하나의 상태. 화면은 이것만 보고 그린다. */
export interface ListState<TItem> {
  items: TItem[];
  loading: boolean;
  /** 실패 문구. 성공했으면 null. */
  error: string | null;
  reload: () => void;
}

/** 실시간 이벤트로 목록을 고치는 쪽에서만 쓰는 손잡이. */
interface EditableList<TItem> extends ListState<TItem> {
  setItems: Dispatch<SetStateAction<TItem[]>>;
}

/**
 * 목록을 한 번 받아 둔다.
 *
 * 화면을 떠난 뒤 도착한 응답이 상태를 되살리지 않도록 막는다. 채팅 탭은 탭을 오가며 여러 목록을
 * 번갈아 여는 자리라 이 경합이 실제로 일어난다.
 *
 * `load`는 렌더마다 새로 만들어지는 함수라 의존값에 넣지 않는다. 다시 받는 시점은 `reload`가
 * 올리는 값이 정한다.
 *
 * 주기 조회(10초 폴링)는 지웠다. 새 채팅 요청이 실시간 이벤트 없이 방만 만들던 동안의
 * 임시 수단이었는데, 서버가 요청 도착도 개인 큐로 쏘기 시작했다(`CHAT_ROOM_REQUESTED`,
 * 2026-08-05 확인). 이제 목록은 이벤트로 고치고, 초점 복귀 재조회가 이벤트를 놓친 경우
 * (소켓 끊김 등)를 받친다.
 */
function useList<TItem>(load: () => Promise<TItem[]>, enabled = true): EditableList<TItem> {
  const [items, setItems] = useState<TItem[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [requestedAt, setRequestedAt] = useState(0);

  const reload = useCallback(() => setRequestedAt((value) => value + 1), []);

  const loadRef = useRef(load);
  loadRef.current = load;

  /**
   * 한 번이라도 받아 봤는지. 받아 본 뒤의 재조회는 로딩을 보여주지 않는다 — 초점 복귀와 주기
   * 조회가 잦아져서, 그때마다 목록이 스피너로 바뀌면 화면이 계속 깜빡인다.
   */
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      setItems([]);
      setLoading(false);
      hasLoadedRef.current = false;
      return;
    }

    let alive = true;

    setLoading(!hasLoadedRef.current);
    setError(null);

    loadRef
      .current()
      .then((result) => {
        if (!alive) return;

        hasLoadedRef.current = true;
        setItems(result);
        setLoading(false);
      })
      .catch((cause: unknown) => {
        if (!alive) return;

        setError(cause instanceof Error ? cause.message : '목록을 불러오지 못했어요');
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [enabled, requestedAt]);

  /*
    화면으로 돌아올 때 다시 받는다.

    채팅 목록 화면은 탭을 옮겨도 살아 있어서, 마운트 때 한 번 받고 끝나면 그 뒤에 생긴 일이
    보이지 않는다. 실시간 이벤트가 대부분 메우지만, 소켓이 끊긴 사이의 일은 이벤트로 오지
    않는다 — 초점 복귀가 그 빈틈을 받친다.

    첫 초점은 건너뛴다. 위 효과가 방금 받아 온 직후라 같은 요청을 두 번 보내게 된다.
  */
  const focused = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (!focused.current) {
        focused.current = true;
        return;
      }

      if (enabled) reload();
    }, [enabled, reload]),
  );

  return { items, setItems, loading, error, reload };
}

/**
 * 방을 읽었다는 신호를 받아 처리한다.
 *
 * 신호는 읽음 갱신이 **서버에 저장된 뒤** 온다. 그래서 목록을 다시 부르지 않고 처리해도
 * 서버와 어긋나지 않고, 방을 나온 직후의 재조회와 경합하지도 않는다 — 재조회가 먼저 끝나
 * 옛 값을 보여줘도 이 신호가 덮는다.
 */
function useRoomReadSignal(onRead: (roomId: number) => void): void {
  const handlerRef = useRef(onRead);
  handlerRef.current = onRead;

  useEffect(() => onRoomRead((roomId) => handlerRef.current(roomId)), []);
}

/** 방 목록에서 읽은 방의 점을 끈다. */
function clearUnread(rooms: ChatRoomListItem[], roomId: number): ChatRoomListItem[] {
  if (!rooms.some((room) => room.roomId === roomId && room.hasUnread)) return rooms;

  return rooms.map((room) => (room.roomId === roomId ? { ...room, hasUnread: false } : room));
}

/**
 * 내가 요청한 대화 목록.
 *
 * 실시간 이벤트로 마지막 메시지·안 읽음·상태를 그 자리에서 고친다. 새 요청 이벤트는 내가
 * **요청받은** 쪽이라 이 목록과 무관하므로 무시한다.
 */
export function useMyChatRooms(): ListState<ChatRoomListItem> {
  const list = useList(getChatRooms);
  const { setItems } = list;

  useUserChatEvents((event) => {
    if (needsReload(event)) return;

    setItems((rooms) => applyUserChatEvent(rooms, event));
  });

  useRoomReadSignal((roomId) => setItems((rooms) => clearUnread(rooms, roomId)));

  return list;
}

/**
 * 요청이 온 내 게시글 목록. 새 요청 이벤트(`CHAT_ROOM_REQUESTED`)가 오면 다시 받는다 —
 * 없던 글이 생길 수 있다.
 */
export function useChatPins(): ListState<ChatPinListItem> {
  const list = useList(getChatPins);
  const { reload, setItems } = list;

  useUserChatEvents((event) => {
    if (needsReload(event)) {
      reload();
      return;
    }

    // 새 메시지는 글 단위로 점만 켠다. 이 목록은 마지막 메시지를 보여주지 않는다.
    setItems((pins) => applyUserChatEventToPins(pins, event));
  });

  /*
    방 하나를 읽었다고 글의 점을 바로 끌 수는 없다 — 같은 글의 **다른 방**에 안 읽은 것이
    남았을 수 있고, 이 목록은 방 단위 상태를 갖고 있지 않다. 서버에 다시 물어 글 단위로
    계산된 값을 받는다.

    잠깐 모아서 부른다. 방 안에서 대화가 오가면 메시지마다 읽음 신호가 오는데, 그때마다
    다시 받으면(핀마다 방 목록까지 붙는 조회라) 요청이 몰린다. 신호가 잦아든 뒤 한 번이면
    충분하다 — 이 목록은 그 순간 화면에 보이지도 않는다.
  */
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useRoomReadSignal(() => {
    if (reloadTimerRef.current !== null) clearTimeout(reloadTimerRef.current);

    reloadTimerRef.current = setTimeout(() => {
      reloadTimerRef.current = null;
      reload();
    }, 600);
  });

  useEffect(
    () => () => {
      if (reloadTimerRef.current !== null) clearTimeout(reloadTimerRef.current);
    },
    [],
  );

  return list;
}

/**
 * 게시글 하나에 달린 채팅방 목록.
 *
 * `pinId`가 null이면 아직 고르지 않은 상태라 요청하지 않는다.
 */
export function usePinChatRooms(pinId: PinId | null): ListState<ChatRoomListItem> {
  // 이 글에 새 요청이 들어오면 `CHAT_ROOM_REQUESTED` 이벤트가 아래에서 재조회를 일으킨다.
  const list = useList(() => (pinId === null ? Promise.resolve([]) : getPinChatRooms(pinId)), pinId !== null);
  const { reload, setItems } = list;

  useUserChatEvents((event) => {
    if (needsReload(event)) {
      reload();
      return;
    }

    setItems((rooms) => applyUserChatEvent(rooms, event));
  });

  useRoomReadSignal((roomId) => setItems((rooms) => clearUnread(rooms, roomId)));

  return list;
}
