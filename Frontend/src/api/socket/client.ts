import { Client } from '@stomp/stompjs';
import type { IMessage, StompSubscription } from '@stomp/stompjs';
import { HEARTBEAT_MS, RECONNECT_DELAY_MS, getSocketUrl } from './config';

/**
 * STOMP 소켓 단일 연결을 관리한다.
 *
 * - 로그인 시 `connect()`, 로그아웃 시 `disconnect()`를 호출한다. 화면 단위로 열고 닫지 않는다.
 *   채팅방 밖에서도 알림 신호를 받아야 하기 때문이다.
 * - 구독은 `subscribe()`로 등록하고, 끊겼다 붙어도 자동으로 다시 걸린다.
 *   호출부가 재연결을 신경 쓰지 않게 하려는 목적이다.
 * - 인증 토큰은 매 연결 직전에 다시 읽는다. 재연결 시점에 토큰이 갱신됐을 수 있다.
 */

export type SocketStatus = 'idle' | 'connecting' | 'connected' | 'error';

/** 구독 핸들러. `body`는 JSON이면 파싱된 값, 아니면 원본 문자열이다. */
export type MessageHandler = (body: unknown, message: IMessage) => void;

/** 만료된 액세스 토큰을 새로 발급받는다. 실패하면 null을 반환해 재연결을 멈춘다. */
export type TokenProvider = () => string | null | Promise<string | null>;

interface Registration {
    destination: string;
    handler: MessageHandler;
    subscription: StompSubscription | null;
}

function parseBody(message: IMessage): unknown {
    try {
        return JSON.parse(message.body);
    } catch {
        return message.body;
    }
}

class SocketClient {
    private client: Client | null = null;
    private tokenProvider: TokenProvider | null = null;
    private status: SocketStatus = 'idle';

    /** 구독 등록부. 재연결 후 이 목록을 그대로 다시 구독한다. */
    private registrations = new Map<symbol, Registration>();
    private statusListeners = new Set<(status: SocketStatus) => void>();

    getStatus(): SocketStatus {
        return this.status;
    }

    /** 연결 상태 구독. 해제 함수를 반환한다. */
    onStatusChange(listener: (status: SocketStatus) => void): () => void {
        this.statusListeners.add(listener);
        return () => {
            this.statusListeners.delete(listener);
        };
    }

    private setStatus(next: SocketStatus): void {
        if (this.status === next) return;
        this.status = next;
        this.statusListeners.forEach((listener) => listener(next));
    }

    /**
     * 소켓을 연결한다. 이미 연결돼 있으면 아무것도 하지 않는다.
     * `tokenProvider`는 최초 연결과 매 재연결 직전에 호출된다.
     */
    connect(tokenProvider: TokenProvider): void {
        this.tokenProvider = tokenProvider;
        if (this.client?.active) return;

        const client = new Client({
            brokerURL: getSocketUrl(),
            reconnectDelay: RECONNECT_DELAY_MS,
            heartbeatIncoming: HEARTBEAT_MS,
            heartbeatOutgoing: HEARTBEAT_MS,
            debug: __DEV__ ? (message) => console.log('[socket]', message) : undefined,
        });

        // 재연결 때마다 토큰을 다시 읽어 CONNECT 프레임 헤더에 싣는다.
        client.beforeConnect = async () => {
            const token = await this.tokenProvider?.();
            if (!token) {
                // 토큰이 없으면 붙어봐야 인증에서 끊긴다. 재연결 루프를 멈춘다.
                this.setStatus('error');
                void client.deactivate();
                return;
            }
            client.connectHeaders = { Authorization: `Bearer ${token}` };
            this.setStatus('connecting');
        };

        client.onConnect = () => {
            this.setStatus('connected');
            this.registrations.forEach((registration) => this.attach(registration));
        };

        client.onWebSocketClose = () => {
            // 재연결은 stompjs가 알아서 시도한다. 끊긴 구독 핸들만 비운다.
            this.registrations.forEach((registration) => {
                registration.subscription = null;
            });
            if (this.status === 'connected') this.setStatus('connecting');
        };

        client.onStompError = (frame) => {
            // TODO: 백엔드가 ERROR 프레임 코드를 확정하면 "토큰 만료 → 갱신 후 재연결"과
            //       "그 외 → 중단"을 구분한다. 지금은 무한 재연결을 막기 위해 모두 중단한다.
            console.warn('[socket] STOMP error', frame.headers.message, frame.body);
            this.setStatus('error');
            void client.deactivate();
        };

        this.client = client;
        client.activate();
    }

    /** 연결을 끊고 등록된 구독을 모두 버린다. 로그아웃 시 호출한다. */
    async disconnect(): Promise<void> {
        this.registrations.clear();
        this.tokenProvider = null;

        const client = this.client;
        this.client = null;
        this.setStatus('idle');

        if (client) await client.deactivate();
    }

    /**
     * destination을 구독한다. 연결 전에 호출해도 되며, 연결되는 시점에 자동으로 걸린다.
     * 반환된 함수를 호출하면 구독을 해제한다.
     */
    subscribe(destination: string, handler: MessageHandler): () => void {
        const key = Symbol(destination);
        const registration: Registration = { destination, handler, subscription: null };

        this.registrations.set(key, registration);
        if (this.client?.connected) this.attach(registration);

        return () => {
            registration.subscription?.unsubscribe();
            this.registrations.delete(key);
        };
    }

    /** 메시지를 발행한다. 연결돼 있지 않으면 false를 반환해 호출부가 REST로 우회할 수 있게 한다. */
    publish(destination: string, body: unknown): boolean {
        if (!this.client?.connected) return false;

        this.client.publish({ destination, body: JSON.stringify(body) });
        return true;
    }

    private attach(registration: Registration): void {
        if (!this.client?.connected || registration.subscription) return;

        registration.subscription = this.client.subscribe(registration.destination, (message) => {
            registration.handler(parseBody(message), message);
        });
    }
}

/** 앱 전체가 공유하는 단일 소켓. */
export const socketClient = new SocketClient();
