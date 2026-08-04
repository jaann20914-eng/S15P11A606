import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useFocusEffect } from 'expo-router';
import { getChatPins } from '@/api/chat/pins';
import { getChatRooms, getPinChatRooms } from '@/api/chat/rooms';
import type { ChatPinListItem, ChatRoomListItem } from '@/types/chat';
import type { PinId } from '@/types/pin';
import { applyUserChatEvent, applyUserChatEventToPins, needsReload } from '../roomListUpdates';
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
 */
function useList<TItem>(load: () => Promise<TItem[]>, enabled = true): EditableList<TItem> {
  const [items, setItems] = useState<TItem[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [requestedAt, setRequestedAt] = useState(0);

  const reload = useCallback(() => setRequestedAt((value) => value + 1), []);

  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    if (!enabled) {
      setItems([]);
      setLoading(false);
      return;
    }

    let alive = true;

    setLoading(true);
    setError(null);

    loadRef
      .current()
      .then((result) => {
        if (!alive) return;

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
    보이지 않는다. 실시간 이벤트가 메우는 것도 있지만 **채팅 요청은 이벤트가 오지 않는다** —
    요청을 받아도 목록이 그대로였다.

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

  return list;
}

/** 요청이 온 내 게시글 목록. 새 요청이 오면 다시 받는다 — 없던 글이 생길 수 있다. */
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

  return list;
}

/**
 * 게시글 하나에 달린 채팅방 목록.
 *
 * `pinId`가 null이면 아직 고르지 않은 상태라 요청하지 않는다.
 */
export function usePinChatRooms(pinId: PinId | null): ListState<ChatRoomListItem> {
  const list = useList(
    () => (pinId === null ? Promise.resolve([]) : getPinChatRooms(pinId)),
    pinId !== null,
  );
  const { reload, setItems } = list;

  useUserChatEvents((event) => {
    if (needsReload(event)) {
      reload();
      return;
    }

    setItems((rooms) => applyUserChatEvent(rooms, event));
  });

  return list;
}
