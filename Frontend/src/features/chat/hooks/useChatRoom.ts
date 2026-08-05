import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getChatHistory } from '@/api/chat/messages';
import { getMyProfile } from '@/api/user/profile';
import { updateChatRead } from '@/api/chat/read';
import { sendChatMessage } from '@/api/chat/socket/messages';
import { usesMock } from '@/api/config';
import { appendMockChatMessage } from '@/mocks/chat';
import type { ChatMessage, ChatRoomHistory, ChatRoomStatus, ChatWarning } from '@/types/chat';
import type { ChatRoomEvent } from '@/types/chatSocket';
import { createDevLogger } from '@/utils/devLog';
import { enterRoom, notifyRoomRead } from '../readTracker';
import { useChatRoomEvents, useUserChatEvents } from './useChatEvents';

const log = createDevLogger('chat-room');

/** 내 사용자 id. 앱을 켜고 한 번 받으면 바뀌지 않으므로 방마다 다시 묻지 않는다. */
let cachedMyUserId: number | null = null;

/** 방 헤더에 쓰는 정보. 이력 응답에서 메시지만 뺀 나머지다. */
export interface ChatRoomInfo {
  status: ChatRoomStatus;
  placeName: string;
  address: string;
  otherUserViewTemperature: number;
  otherUserNickname: string;
}

export interface ChatRoomState {
  /** 첫 이력을 받아오는 중. 다시 불러오는 중에는 참이 되지 않는다. */
  loading: boolean;
  /** 이력을 못 받았을 때의 안내 문구. 받은 뒤에는 null. */
  error: string | null;
  reload: () => void;
  info: ChatRoomInfo | null;
  messages: ChatMessage[];
  /** 지금까지 쌓인 안전 경고 전체. 들어올 때 안내를 띄우는 데 쓴다. */
  warnings: ChatWarning[];
  /** 방금 도착한 경고. 팝업으로 한 번 보여주고 `dismissWarning`으로 닫는다. */
  arrivedWarning: ChatWarning | null;
  dismissWarning: () => void;
  /** 지금 보낼 수 있는지. 거절·종료된 방에서는 거짓이다. */
  canSend: boolean;
  send: (content: string) => void;
  /** 보내지 못했을 때의 안내. 다음 전송이나 `dismissSendError`로 지운다. */
  sendError: string | null;
  dismissSendError: () => void;
}

/**
 * 이력을 못 받은 이유를 사람 말로 바꾼다.
 *
 * 방 화면은 목록에서 넘어오는 곳이라, 이미 없어진 방이나 남의 방으로 들어오는 일이 실제로
 * 생긴다(목록이 오래된 경우). 그때 "오류가 발생했습니다"만 띄우면 사용자가 할 수 있는 게 없다.
 */
function describeHistoryError(cause: unknown): string {
  const code = (cause as { code?: string } | null)?.code;

  if (code === 'CHAT_ROOM_ACCESS_DENIED') return '이 대화를 볼 수 있는 권한이 없어요.';
  if (code === 'CHAT_ROOM_NOT_FOUND') return '이미 사라진 대화예요.';
  if (code === 'UNAUTHORIZED') return '다시 로그인한 뒤 열어 주세요.';

  return '대화를 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.';
}

/** 보낼 수 있는 상태인지. 수락 전(`PENDING`)에도 요청자는 보낼 수 있다(서버 정책). */
function isSendable(status: ChatRoomStatus | undefined): boolean {
  return status === 'PENDING' || status === 'ACTIVE';
}

/**
 * 채팅방 하나를 화면에 그릴 상태로 만든다.
 *
 * 이력(REST) 한 번 + 실시간 이벤트(소켓) 구독으로 굴러간다. 보낸 메시지도 화면에 바로 붙이지
 * 않고 서버가 되돌려 주는 `MESSAGE_CREATED`를 기다린다 — 그래야 순서와 내용(마스킹 결과)이
 * 서버가 가진 것과 어긋나지 않는다. 목업일 때만 그 왕복이 없어 직접 붙인다.
 *
 * 읽음 위치는 **화면에 표시된** 메시지 중 가장 큰 id로만 갱신한다(명세). 이력을 받은 직후,
 * 새 메시지가 화면에 붙은 직후, 그리고 방을 떠날 때 보낸다. 도착할 때마다 보내는 이유는
 * 목록의 안 읽음 점 때문이다 — 방을 보고 있는 동안 도착한 메시지는 그 자리에서 읽힌 것이고,
 * 떠날 때까지 미루면 그 사이 서버가 계산하는 안 읽음과 실제 읽은 상태가 어긋난다(카카오톡과
 * 같은 규칙). 갱신은 멱등하고 값이 같으면 부르지 않으므로 부담이 크지 않다.
 */
export function useChatRoom(roomId: number | null): ChatRoomState {
  const [history, setHistory] = useState<ChatRoomHistory | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [warnings, setWarnings] = useState<ChatWarning[]>([]);
  const [arrivedWarning, setArrivedWarning] = useState<ChatWarning | null>(null);
  const [status, setStatus] = useState<ChatRoomStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  /**
   * 화면에 표시된 메시지 중 가장 큰 id.
   *
   * 상태가 아니라 참조로 둔다. 이 값이 바뀔 때마다 화면을 다시 그릴 필요가 없고, 떠날 때
   * 정리하는 함수가 마지막 값을 읽어야 한다.
   */
  const latestDisplayedRef = useRef<number | null>(null);
  /** 읽음으로 이미 서버에 보낸 값. 같은 값을 두 번 보내지 않으려고 둔다. */
  const reportedReadRef = useRef<number | null>(null);

  /**
   * 내 사용자 id.
   *
   * 이력은 서버가 `SELF`/`OTHER`로 내려주지만 소켓 이벤트는 `senderId`(숫자)로 온다. 내
   * 프로필(`GET /users/me`)에서 한 번 받아 두고 그 값과 비교한다.
   *
   * 예전에는 **내가 보낸 내용이 되돌아올 때** senderId를 내 id로 학습했는데, 상대가 같은
   * 내용을 보내면(빠른 질문 버튼을 양쪽이 누르는 경우) 상대 id를 내 것으로 잘못 배워 그
   * 방의 말풍선이 통째로 뒤집혔다(2026-08-06). 추측하지 않고 서버에 묻는다.
   *
   * 받기 전에 도착한 메시지는 남이 보낸 것으로 둔다 — 내 메시지를 남의 것으로 잠깐 보여주는
   * 편이, 남의 메시지를 내 것으로 보여주는 것보다 낫다. 방을 다시 열면 이력이 바로잡는다.
   */
  const myUserIdRef = useRef<number | null>(cachedMyUserId);

  useEffect(() => {
    if (myUserIdRef.current !== null) return;

    let alive = true;

    getMyProfile()
      .then((profile) => {
        cachedMyUserId = profile.userId;
        if (alive) myUserIdRef.current = profile.userId;
      })
      .catch(() => {
        // 못 받으면 이번 방에서는 소켓 메시지가 전부 남의 것으로 보인다. 다음 진입에서 다시 받는다.
      });

    return () => {
      alive = false;
    };
  }, []);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    if (roomId === null) return;

    let alive = true;

    setLoading(history === null);
    setError(null);

    getChatHistory(roomId)
      .then((loaded) => {
        if (!alive) return;

        setHistory(loaded);
        setStatus(loaded.status);
        setMessages(loaded.messages);
        setWarnings(loaded.warnings);

        // 이력을 받은 시점의 마지막 메시지가 곧 "화면에 표시된 것 중 가장 큰 id"다.
        latestDisplayedRef.current = loaded.messages.at(-1)?.messageId ?? null;
      })
      .catch((cause: unknown) => {
        if (!alive) return;

        setError(describeHistoryError(cause));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
    // 다시 불러올 때 `history`가 바뀌었다고 또 부르면 안 되므로 의존성에 두지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, reloadKey]);

  /**
   * 읽음 위치를 서버에 알린다.
   *
   * 보낼 것이 없거나(메시지가 없는 방) 이미 같은 값을 보냈으면 부르지 않는다. 실패해도 화면에
   * 알리지 않는다 — 사용자가 할 수 있는 일이 없고, 다음에 들어올 때 다시 보낸다.
   */
  const reportRead = useCallback(() => {
    if (roomId === null) return;

    const latest = latestDisplayedRef.current;

    if (latest === null) return;
    if (reportedReadRef.current !== null && reportedReadRef.current >= latest) return;

    reportedReadRef.current = latest;

    updateChatRead(roomId, latest)
      .then(() => {
        // 목록들이 이 방의 안 읽음 점을 끄게 한다. 서버 재조회와 경합하지 않는 유일한 길이다.
        notifyRoomRead(roomId);
      })
      .catch(() => {
        // 다음 진입에서 다시 보내도록 되돌려 둔다.
        reportedReadRef.current = null;
      });
  }, [roomId]);

  /*
   * 이 방을 보고 있다고 알린다. 목록들은 열려 있는 방의 새 메시지 이벤트에 점을 켜지 않는다 —
   * 지금 읽히고 있는 메시지이기 때문이다.
   */
  useEffect(() => {
    if (roomId === null) return;

    return enterRoom(roomId);
  }, [roomId]);

  /** 이력을 받은 직후 한 번. 그 뒤로는 떠날 때 정리한다. */
  useEffect(() => {
    if (history !== null) reportRead();
  }, [history, reportRead]);

  useEffect(() => reportRead, [reportRead]);

  const handleEvent = useCallback(
    (event: ChatRoomEvent) => {
      if (event.eventType === 'MESSAGE_CREATED') {
        const { messageId, senderId, content, maskedContent, createdAt } = event.data;

        const sender = myUserIdRef.current === senderId ? 'SELF' : 'OTHER';

        setMessages((current) => {
          // 같은 메시지가 두 번 오는 경우(재연결 직후 등)를 막는다.
          if (current.some((message) => message.messageId === messageId)) return current;

          return [...current, { messageId, sender, content, maskedContent, createdAt }];
        });

        // 화면에 붙었으니 곧바로 읽음이다. 보고 있는 사람에게 도착한 메시지를 안 읽음으로 두지 않는다.
        latestDisplayedRef.current = Math.max(latestDisplayedRef.current ?? 0, messageId);
        reportRead();
        return;
      }

      if (event.eventType === 'WARNING_CREATED') {
        const warning = event.data;

        /*
        같은 경고가 두 번 들어오지 않게 한다.

        식별자가 있으면 그것으로 보고, 없으면(실시간 이벤트에는 없다) 사유와 도착 시각이 같은
        것을 같은 경고로 본다. 재연결 직후 같은 프레임을 다시 받는 경우를 막기 위한 것이다.
      */
        setWarnings((current) =>
          current.some((item) =>
            warning.messageId === undefined
              ? item.reasonCode === warning.reasonCode && item.createdAt === warning.createdAt
              : item.messageId === warning.messageId,
          )
            ? current
            : [...current, warning],
        );
        setArrivedWarning(warning);
        log('경고 도착', { roomId: event.roomId, 사유: warning.reasonCode });
        return;
      }

      setStatus(event.data.status);
      log('상태 변경', { roomId: event.roomId, 상태: event.data.status });
    },
    [reportRead],
  );

  useChatRoomEvents(roomId, handleEvent);

  /*
    상태 변경은 **개인 큐로만** 온다.

    서버는 수락·거절·떠남·삭제를 방 토픽(`/topic/chat/rooms/{roomId}`)에 쏘지 않고 상대의
    개인 큐(`/user/queue/chat-rooms`)로만 보낸다 — 방 토픽에는 메시지와 경고뿐이다. 그래서
    방 토픽만 듣던 동안에는, 대기 중인 방에 들어가 있는 요청자가 상대의 수락을 받아도
    입력칸이 잠긴 채였다(2026-08-05). 개인 큐를 함께 듣고 이 방의 상태 변경만 집어 온다.

    위 `handleEvent`의 상태 분기는 남겨 둔다 — 서버가 방 토픽에도 쏘기 시작하면 그대로 받는다.
  */
  useUserChatEvents((event) => {
    if (event.eventType !== 'CHAT_ROOM_STATUS_CHANGED' || roomId === null) return;
    if (event.data.roomId !== roomId) return;

    setStatus(event.data.status);
    log('상태 변경(개인 큐)', { roomId, 상태: event.data.status });
  });

  const send = useCallback(
    (content: string) => {
      const trimmed = content.trim();

      if (roomId === null || trimmed.length === 0) return;

      setSendError(null);

      /*
        목업에는 서버 왕복이 없다. 소켓도 열리지 않으므로 여기서 붙여 주지 않으면 보낸 말이
        사라진 것처럼 보인다.
      */
      if (usesMock('chat/messages')) {
        const created = appendMockChatMessage(roomId, trimmed);

        setMessages((current) => [...current, created]);
        latestDisplayedRef.current = Math.max(latestDisplayedRef.current ?? 0, created.messageId);
        return;
      }

      const { delivered, clientMessageId } = sendChatMessage(roomId, trimmed);

      log('메시지 전송', { roomId, 전달: delivered, clientMessageId });

      if (!delivered) {
        setSendError('연결이 끊겨 보내지 못했어요. 잠시 뒤 다시 시도해 주세요.');
      }
    },
    [roomId],
  );

  const info = useMemo<ChatRoomInfo | null>(() => {
    if (history === null) return null;

    return {
      // 상태는 이벤트로 바뀔 수 있어 이력의 값보다 최신을 쓴다.
      status: status ?? history.status,
      placeName: history.placeName,
      address: history.address,
      otherUserViewTemperature: history.otherUserViewTemperature,
      otherUserNickname: history.otherUserNickname,
    };
  }, [history, status]);

  return {
    loading,
    error,
    reload,
    info,
    messages,
    warnings,
    arrivedWarning,
    dismissWarning: useCallback(() => setArrivedWarning(null), []),
    canSend: isSendable(info?.status),
    send,
    sendError,
    dismissSendError: useCallback(() => setSendError(null), []),
  };
}
