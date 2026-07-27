/**
 * 소켓 접속 정보.
 *
 * 2026-07-27 기준 백엔드와 경로·destination이 확정되지 않았다.
 * 확정되면 이 파일의 값만 교체하면 되고, 연결·재연결·구독 로직은 수정할 필요가 없다.
 */

/** STOMP 엔드포인트. SockJS 없이 순수 WebSocket으로 접속한다. */
const SOCKET_ENDPOINT = '/ws';

/**
 * 구독·발행 경로.
 *
 * 백엔드가 방 단위 토픽(`/topic/chat/{roomId}`)으로 정하면 `chat`을 함수로 바꾼다.
 * 사용자 단위 큐를 유지한다면 메시지 페이로드에 `roomId`가 포함되어야 방을 구분할 수 있다.
 */
export const destinations = {
    /** 구독 — 내가 참여한 방의 새 메시지 */
    chat: '/user/queue/chat',
    /** 구독 — 안읽음 표시용 알림 신호 */
    notification: '/user/queue/notification',
    /** 발행 — 읽음 처리. 소켓이 끊겨 있으면 REST `PATCH /chat/rooms/{roomId}/read`를 쓴다. */
    read: (roomId: number) => `/app/chat/${roomId}/read`,
} as const;

/** 끊긴 뒤 재연결까지 대기하는 시간. 0이면 재연결하지 않는다. */
export const RECONNECT_DELAY_MS = 5_000;

/** heartbeat 주기. 서버 설정이 다르면 맞춘다. */
export const HEARTBEAT_MS = 10_000;

/**
 * `http(s)://host` 형태의 API 주소를 `ws(s)://host`로 바꾼다.
 * 별도 소켓 주소를 쓰는 환경이면 `EXPO_PUBLIC_WS_BASE_URL`을 설정한다.
 */
function toWebSocketOrigin(httpUrl: string): string {
    return httpUrl.replace(/^http/, 'ws');
}

/** 접속할 소켓 URL. 환경변수가 없으면 호출 시점에 실패시킨다. */
export function getSocketUrl(): string {
    const explicit = process.env.EXPO_PUBLIC_WS_BASE_URL;
    const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
    const origin = explicit ?? (apiBaseUrl ? toWebSocketOrigin(apiBaseUrl) : undefined);

    if (!origin) {
        throw new Error('EXPO_PUBLIC_API_BASE_URL이 설정되지 않았어요');
    }

    return `${origin}${SOCKET_ENDPOINT}`;
}
