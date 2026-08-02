import { Client } from '@stomp/stompjs';
import type { IMessage, StompSubscription } from '@stomp/stompjs';
import { useAuthStore } from '@/store/useAuthStore';
import type { SocketStatus } from '@/types/chatSocket';
import { HEARTBEAT_MS, RECONNECT_DELAYS_MS, STOMP_VERSION, canUseSocket, resolveSocketUrl } from './config';

/**
 * 채팅 STOMP 연결.
 *
 * 앱 전체에서 **하나만** 쓴다. 채팅방을 옮길 때마다 연결을 새로 맺지 않고 구독만 바꾼다 —
 * 핸드셰이크와 인증을 매번 다시 하는 비용이 크고, 그 사이 도착한 이벤트를 놓친다.
 *
 * 연결을 여는 시점은 화면이 정한다(`retain`). 채팅 영역에 있는 화면이 하나도 남지 않으면
 * 자동으로 끊는다. 여는 곳과 닫는 곳이 갈리면 화면 하나가 먼저 내려갔다는 이유로 다른
 * 화면의 실시간 갱신이 멈추기 때문에, 세는 일을 이 모듈이 맡는다.
 */

/** 구독 하나의 신청서. 재연결 뒤 그대로 다시 신청한다. */
interface Registration {
  id: string;
  destination: string;
  handler: (body: string) => void;
  /** 지금 살아 있는 구독. 연결 전이거나 끊긴 동안에는 null이다. */
  active: StompSubscription | null;
}

const registrations = new Map<string, Registration>();
const statusListeners = new Set<(status: SocketStatus) => void>();

let client: Client | null = null;
let status: SocketStatus = canUseSocket ? 'idle' : 'disabled';
let holders = 0;
let attempt = 0;

/**
 * 토큰이 만료돼 다시 받아 본 적이 있는지.
 *
 * 갱신하고도 또 만료라고 하면 우리가 고칠 수 있는 문제가 아니다. 한 번만 시도해
 * "갱신 → 거절 → 갱신"이 끝없이 도는 것을 막는다. 연결에 성공하면 다시 풀어 준다.
 */
let refreshedForThisConnection = false;

function setStatus(next: SocketStatus): void {
  if (status === next) return;

  status = next;
  statusListeners.forEach((listener) => listener(next));
}

export function getSocketStatus(): SocketStatus {
  return status;
}

export function subscribeToSocketStatus(listener: (status: SocketStatus) => void): () => void {
  statusListeners.add(listener);

  return () => statusListeners.delete(listener);
}

/** 다음 재연결까지 기다릴 시간. 마지막 값에 닿으면 그 간격을 유지한다. */
function nextDelay(): number {
  const index = Math.min(attempt, RECONNECT_DELAYS_MS.length - 1);

  return RECONNECT_DELAYS_MS[index];
}

function activate(registration: Registration): void {
  if (client === null || !client.connected || registration.active !== null) return;

  registration.active = client.subscribe(
    registration.destination,
    (message: IMessage) => registration.handler(message.body),
    { id: registration.id, ack: 'auto' },
  );
}

function createClient(): Client {
  return new Client({
    brokerURL: resolveSocketUrl(),
    /*
      토큰은 연결할 때마다 새로 읽는다. 재연결 사이에 갱신됐을 수 있고, 처음 만들 때 박아 두면
      만료된 값으로 계속 두드리게 된다.
    */
    beforeConnect: () => {
      const { accessToken } = useAuthStore.getState();

      client?.configure({
        connectHeaders: {
          'accept-version': STOMP_VERSION,
          Authorization: accessToken === null ? '' : `Bearer ${accessToken}`,
        },
      });
    },
    heartbeatIncoming: HEARTBEAT_MS,
    heartbeatOutgoing: HEARTBEAT_MS,
    /*
      라이브러리의 고정 간격 대신 우리가 정한다. 끊긴 직후에 값을 바꾸면 그 시점의 예약에
      반영된다. 여기서 0을 주면 재연결을 아예 하지 않는다.
    */
    reconnectDelay: RECONNECT_DELAYS_MS[0],

    onConnect: () => {
      attempt = 0;
      refreshedForThisConnection = false;
      setStatus('connected');

      // 이전 세션의 구독은 함께 끊겼다. 살아 있다고 표시된 것도 지우고 새로 신청한다.
      registrations.forEach((registration) => {
        registration.active = null;
        activate(registration);
      });
    },

    onStompError: (frame) => {
      handleErrorFrame(frame.body);
    },

    onWebSocketClose: () => {
      registrations.forEach((registration) => {
        registration.active = null;
      });

      if (holders === 0) {
        setStatus('idle');
        return;
      }

      attempt += 1;
      client?.configure({ reconnectDelay: nextDelay() });
      setStatus('reconnecting');
    },
  });
}

/**
 * ERROR 프레임 처리.
 *
 * 토큰 만료는 우리가 회복할 수 있는 유일한 경우다. 갱신해 두면 곧 이어질 재연결이 새 토큰을
 * 집어 간다. 나머지 코드는 클라이언트가 할 수 있는 일이 없어 상태만 남긴다.
 */
function handleErrorFrame(body: string): void {
  const code = readErrorCode(body);

  if (code !== 'WEBSOCKET_TOKEN_EXPIRED' || refreshedForThisConnection) return;

  refreshedForThisConnection = true;
  void useAuthStore.getState().refreshAccessToken().catch(() => undefined);
}

function readErrorCode(body: string): string | null {
  try {
    const parsed: unknown = JSON.parse(body);

    if (typeof parsed === 'object' && parsed !== null && 'code' in parsed) {
      const { code } = parsed as { code?: unknown };

      return typeof code === 'string' ? code : null;
    }
  } catch {
    // JSON이 아닌 오류 본문도 있다. 코드를 못 읽어도 연결 처리는 계속한다.
  }

  return null;
}

/**
 * 연결을 붙잡는다. 돌려받은 함수를 부르면 놓는다.
 *
 * 처음 붙잡을 때 연결을 열고, 마지막 하나가 놓으면 닫는다. 화면마다 `useEffect`에서
 * 붙잡았다 놓기만 하면 되고, 누가 먼저 내려가는지는 신경 쓰지 않아도 된다.
 */
export function retainSocket(): () => void {
  if (!canUseSocket) return () => undefined;

  watchSession();
  holders += 1;

  if (client === null) {
    client = createClient();
  }

  if (!client.active) {
    attempt = 0;
    client.configure({ reconnectDelay: RECONNECT_DELAYS_MS[0] });
    setStatus('connecting');
    client.activate();
  }

  let released = false;

  return () => {
    if (released) return;

    released = true;
    holders -= 1;

    if (holders > 0) return;

    setStatus('idle');
    // DISCONNECT 프레임을 보내고 정리한다. 남은 구독은 세션과 함께 끊긴다.
    void client?.deactivate();
  };
}

/**
 * 구독을 신청한다. 연결 전에 불러도 되고, 연결되면 그때 신청된다.
 *
 * 재연결 뒤에도 이 신청서가 남아 있어 자동으로 다시 구독한다. 명세대로 서버가 구독을 복구해
 * 주지는 않으므로 이 목록이 유일한 기억이다.
 */
export function subscribeDestination(
  id: string,
  destination: string,
  handler: (body: string) => void,
): () => void {
  if (!canUseSocket) return () => undefined;

  const registration: Registration = { id, destination, handler, active: null };

  registrations.set(id, registration);
  activate(registration);

  return () => {
    registrations.delete(id);
    registration.active?.unsubscribe();
    registration.active = null;
  };
}

/** 발행. 연결돼 있지 않으면 보내지 않고 false를 돌려준다. */
export function publish(destination: string, body: unknown): boolean {
  if (client === null || !client.connected) return false;

  client.publish({
    destination,
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });

  return true;
}

/** 세션을 지켜보고 있는지. 소켓을 처음 쓸 때 한 번만 건다. */
let watchingSession = false;

/**
 * 로그아웃되면 남은 화면과 상관없이 끊는다.
 *
 * 스토어가 이 파일을 부르게 하지 않는다. 여기서 이미 스토어를 읽고 있어 서로 부르면 순환
 * 참조가 된다. 대신 이쪽에서 세션을 지켜본다 — 방향이 한쪽이라 어느 쪽을 고쳐도 안전하다.
 */
function watchSession(): void {
  if (watchingSession) return;

  watchingSession = true;

  useAuthStore.subscribe(() => {
    if (useAuthStore.getState().authStatus === 'UNAUTHENTICATED') resetSocket();
  });
}

/**
 * 로그아웃처럼 붙잡은 화면과 상관없이 끊어야 할 때.
 * 세는 값을 0으로 되돌려 남아 있던 화면이 연결을 되살리지 못하게 한다.
 */
export function resetSocket(): void {
  holders = 0;
  registrations.clear();
  setStatus(canUseSocket ? 'idle' : 'disabled');
  void client?.deactivate();
}
