import { AppState } from 'react-native';
import { Client, Versions } from '@stomp/stompjs';
import type { IMessage, StompSubscription } from '@stomp/stompjs';
import { useAuthStore } from '@/store/useAuthStore';
import type { SocketStatus } from '@/types/chatSocket';
import { isTokenExpired } from '@/utils/accessToken';
import { createDevLogger } from '@/utils/devLog';
import { USER_ERRORS_QUEUE, USER_ERRORS_SUBSCRIPTION_ID } from './destinations';
import { HEARTBEAT_MS, RECONNECT_DELAYS_MS, STOMP_VERSION, canUseSocket, resolveSocketUrl } from './config';

const log = createDevLogger('chat-socket');

/**
 * 오가는 프레임을 한 줄씩 남길지.
 *
 * 평소에는 끈다. 하트비트가 10초마다 오가서 켜 두면 다른 로그가 묻힌다. 연결이 이상할 때만
 * 잠깐 켜서 어디서 멈추는지 본다 — 이 값을 켜면 프레임 전문과 소켓 수신이 모두 보인다.
 */
// [임시] AI 경고가 방까지 오는지 추적 중이라 켜 둔다. 확인이 끝나면 다시 끈다.
const TRACE_FRAMES = true;

/** 브라우저·서버가 합의하는 STOMP 하위 프로토콜. 버전을 하나만 제안하므로 값도 하나다. */
const STOMP_SUBPROTOCOLS = [`v${STOMP_VERSION.replace('.', '')}.stomp`];

/** 로그에 토큰이 그대로 남지 않도록 지운다. */
function redactToken(line: string): string {
  return line.replace(/(Authorization:Bearer )\S+/g, '$1<가림>');
}

/**
 * 소켓이 실제로 무엇을 받는지 남긴다. 개발 중에만 붙인다.
 *
 * 라이브러리가 조용히 멈추는 경우를 가르기 위한 것이다 — 서버가 답을 안 보낸 것인지,
 * 답은 왔는데 해석하지 못한 것인지는 이 자리에서만 구분된다.
 */
function listenForDiagnostics(socket: WebSocket): void {
  socket.addEventListener('open', () => log('소켓 열림', { 합의된프로토콜: socket.protocol }));
  socket.addEventListener('message', (event) => {
    const data: unknown = (event as MessageEvent).data;

    log('소켓 수신', {
      형식: typeof data,
      내용: typeof data === 'string' ? data.split('\n')[0] : String(data),
    });
  });
  socket.addEventListener('close', (event) => {
    log('소켓 닫힘', { code: (event as CloseEvent).code, reason: (event as CloseEvent).reason });
  });
}

/**
 * 채팅 STOMP 연결.
 *
 * 앱 전체에서 **하나만** 쓴다. 채팅방을 옮길 때마다 연결을 새로 맺지 않고 구독만 바꾼다 —
 * 핸드셰이크와 인증을 매번 다시 하는 비용이 크고, 그 사이 도착한 이벤트를 놓친다.
 *
 * 여는 시점은 채팅 탭 진입이다(연결 명세). 탭을 벗어나면 끊는다 — 그래서 다른 탭에 있는
 * 동안에는 실시간 이벤트를 받지 못하고, 그건 알림 이슈에서 푸시로 풀 몫이다.
 *
 * 여닫는 주체가 여럿일 수 있으므로(`retain`) 세는 일은 이 모듈이 맡는다 — 화면 하나가 먼저
 * 내려갔다는 이유로 다른 화면의 실시간 갱신이 멈추면 안 된다.
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
      1.2만 제안한다. 기본값은 1.0·1.1·1.2를 모두 제안하는데, 서버가 하나만 받는다면
      `UNSUPPORTED_STOMP_VERSION`으로 끊길 수 있다. 우리가 쓰는 것은 1.2뿐이다.
    */
    stompVersions: new Versions([STOMP_VERSION]),
    /*
      토큰은 연결할 때마다 새로 읽는다. 재연결 사이에 갱신됐을 수 있고, 처음 만들 때 박아 두면
      만료된 값으로 계속 두드리게 된다.

      만료된 토큰이면 먼저 갱신한다. REST는 401을 받고 갱신하면 되지만 소켓에는 그 흐름이
      없다 — 만료된 토큰으로 붙으면 서버가 끊고, 우리는 그것을 "끊겼다"로 보고 같은 토큰으로
      다시 두드린다. 오래 다른 탭에 머물다 돌아왔을 때 실제로 그렇게 된다.

      갱신은 스토어가 한 번만 나가도록 묶어 두므로(RTR), 여기서 불러도 REST 요청과 겹쳐
      리프레시 토큰이 두 번 쓰이는 일은 없다.
    */
    /*
      개발 중에는 프레임을 남긴다. 어디서 멈췄는지는 이것 없이 알기 어렵다.
      **토큰은 지우고 남긴다** — 로그는 캡처로 옮겨 다니므로 그대로 두면 세션이 새어 나간다.
    */
    debug: (line) => {
      if (TRACE_FRAMES) log('stomp', { 줄: redactToken(line) });
    },
    onWebSocketError: (event) => log('소켓 오류', { 내용: String(event?.message ?? event) }),
    /*
      소켓을 직접 만들어 오가는 것을 따로 듣는다.
      라이브러리가 `on*` 자리를 차지하므로 겹치지 않는 `addEventListener`로 붙인다.
    */
    webSocketFactory: () => {
      const socket = new WebSocket(resolveSocketUrl(), STOMP_SUBPROTOCOLS);

      if (__DEV__ && TRACE_FRAMES) listenForDiagnostics(socket);

      return socket;
    },
    beforeConnect: async () => {
      const { accessToken, refreshAccessToken } = useAuthStore.getState();

      if (isTokenExpired(accessToken)) {
        // 실패하면 스토어가 세션을 정리한다. 그때는 세션 감시가 연결을 거둔다.
        await refreshAccessToken().catch(() => undefined);
      }

      const token = useAuthStore.getState().accessToken;

      client?.configure({ connectHeaders: { Authorization: `Bearer ${token ?? ''}` } });
    },
    /*
      프레임을 글자가 아니라 바이트로 주고받는다. **리액트 네이티브에서는 이게 필수다.**

      STOMP 프레임은 끝에 NUL(`\0`)을 붙여 끝을 알리는데, 리액트 네이티브의 WebSocket은
      문자열을 네이티브로 넘기는 과정에서 이 문자를 잘라낸다. 서버는 프레임이 아직 안 끝났다고
      보고 계속 기다리고, 앱은 응답이 오지 않아 멈춘 것처럼 보인다 — 오류도 나지 않는다.
      바이트로 보내면 잘릴 일이 없다.

      받는 쪽도 같은 이유로 NUL이 빠져 올 수 있어 없으면 채워서 해석한다.
    */
    forceBinaryWSFrames: true,
    appendMissingNULLonIncoming: true,
    heartbeatIncoming: HEARTBEAT_MS,
    heartbeatOutgoing: HEARTBEAT_MS,
    /*
      라이브러리의 고정 간격 대신 우리가 정한다. 끊긴 직후에 값을 바꾸면 그 시점의 예약에
      반영된다. 여기서 0을 주면 재연결을 아예 하지 않는다.
    */
    reconnectDelay: RECONNECT_DELAYS_MS[0],

    onConnect: () => {
      log('연결됨', { 주소: resolveSocketUrl() });
      attempt = 0;
      refreshedForThisConnection = false;
      setStatus('connected');

      /*
        이전 세션의 구독은 함께 끊겼다. 살아 있다고 표시된 것도 지우고 새로 신청한다.

        오류 큐는 신청서 목록의 첫 자리에 들어 있어(`watch`) 여기서 가장 먼저 나간다. 구독이
        거절되면 서버는 연결을 끊지 않고 그 큐로만 알려 주므로, 방보다 먼저 열려 있어야
        그사이 온 거절을 놓치지 않는다.
      */
      registrations.forEach((registration) => {
        registration.active = null;
        activate(registration);
      });
    },

    onStompError: (frame) => {
      log('서버가 거절함', { 본문: frame.body });
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
      log('끊김. 다시 붙는다', { 시도: attempt, 대기ms: nextDelay() });
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

  watch();
  holders += 1;

  if (client === null) {
    client = createClient();
  }

  /*
    로그인 전에는 열지 않는다. 채팅 탭에 들어올 수 있는 상태라면 대개 로그인돼 있지만,
    세션이 끊긴 직후처럼 어긋나는 순간이 있다. 그때는 붙잡아만 두고 로그인되면 붙는다.
  */
  if (useAuthStore.getState().accessToken === null) {
    log('로그인 전이라 열지 않음');
  }

  if (!client.active && useAuthStore.getState().accessToken !== null) {
    log('연결 시작', { 주소: resolveSocketUrl() });
    attempt = 0;
    client.configure({ reconnectDelay: RECONNECT_DELAYS_MS[0] });
    setStatus('connecting');
    client.activate();
  }

  let released = false;

  return () => {
    if (released) return;

    released = true;
    /*
      0 밑으로 내려가지 않게 한다. 로그아웃이 세는 값을 0으로 되돌린 뒤(`resetSocket`) 채팅
      화면이 내려가면서 놓는 순간이 있는데, 그때 음수가 되면 다음에 다시 붙잡아도 "아직 놓을
      사람이 남았다"가 되어 연결이 열리지 않는다.
    */
    holders = Math.max(0, holders - 1);

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

  // 같은 id로 다시 신청하면 앞의 것은 버린다. 남겨 두면 서버에는 구독이 둘 남아 같은 이벤트를
  // 두 번 받는다(STOMP는 id가 같으면 덮어쓰지 않는다).
  registrations.get(id)?.active?.unsubscribe();

  const registration: Registration = { id, destination, handler, active: null };

  registrations.set(id, registration);
  activate(registration);

  return () => {
    // 이미 다른 신청서가 이 id를 쓰고 있으면 그건 남의 것이라 지우지 않는다.
    if (registrations.get(id) === registration) registrations.delete(id);

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

/**
 * 구독 거절을 듣는다. **한 번만 신청한다** — 다시 붙을 때는 신청서 목록이 알아서 되살린다.
 *
 * 연결될 때마다 신청하면 그 순간 목록에도 들어가고 곧이어 목록 전체가 다시 신청되어, 같은
 * 구독이 두 번 나간다.
 *
 * 화면이 따로 걸지 않아도 개발 중에는 무엇이 왜 막혔는지 남는다. 화면에서 다뤄야 하는 거절은
 * `useSubscriptionErrors`로 같은 큐를 한 번 더 구독하면 된다 — 구독 식별자가 달라 겹치지 않는다.
 */
function watchSubscriptionErrors(): void {
  subscribeDestination(`${USER_ERRORS_SUBSCRIPTION_ID}-log`, USER_ERRORS_QUEUE, (body) => {
    log('구독 거절', { 본문: body });
  });
}

/** 감시를 걸었는지. 소켓을 처음 쓸 때 한 번만 건다. */
let watching = false;

/**
 * 세션과 앱 상태를 지켜본다.
 *
 * 스토어가 이 파일을 부르게 하지 않는다. 여기서 이미 스토어를 읽고 있어 서로 부르면 순환
 * 참조가 된다. 대신 이쪽에서 지켜본다 — 방향이 한쪽이라 어느 쪽을 고쳐도 안전하다.
 */
function watch(): void {
  if (watching) return;

  watching = true;

  // 화면보다 먼저 신청해 목록의 첫 자리를 차지한다. 연결되면 가장 먼저 구독된다.
  watchSubscriptionErrors();

  useAuthStore.subscribe(() => {
    const { authStatus } = useAuthStore.getState();

    if (authStatus === 'UNAUTHENTICATED') {
      resetSocket();
      return;
    }

    // 토큰이 없어 붙지 못하고 멈춰 있었다면 로그인된 지금 다시 붙는다.
    if (holders > 0 && useAuthStore.getState().accessToken !== null) reconnectNow();
  });

  AppState.addEventListener('change', (next) => {
    if (next !== 'active' || holders === 0) return;

    handleForeground();
  });
}

/**
 * 앱이 다시 앞으로 나왔을 때.
 *
 * 백그라운드에 있는 동안 OS가 소켓을 조용히 끊어도 라이브러리는 한동안 모른다. 하트비트가
 * 알아채기까지 20초쯤 걸리고, 그 사이 화면은 "연결됨"인데 이벤트만 오지 않는 상태가 된다.
 * 돌아온 순간 살아 있는지 확인해 죽었으면 곧바로 다시 붙는다.
 *
 * **연결이 살아 있으면 건드리지 않는다.** 멀쩡한 연결을 끊고 다시 맺으면 그 사이의 이벤트를
 * 오히려 놓친다. 확인은 하트비트에 맡긴다.
 */
function handleForeground(): void {
  if (client !== null && client.connected) return;

  reconnectNow();
}

/** 기다리던 재연결 예약을 앞당겨 지금 시도한다. */
function reconnectNow(): void {
  if (client === null) return;

  attempt = 0;
  client.configure({ reconnectDelay: RECONNECT_DELAYS_MS[0] });

  if (!client.active) {
    setStatus('connecting');
    void client.activate();
    return;
  }

  /*
    이미 재연결을 기다리는 중이면(최대 10초) 그 예약을 앞당긴다. 되살리는 가장 확실한 방법은
    한 번 끊는 것이다 — 닫힘 처리가 곧바로 1초짜리 재연결을 잡는다.
  */
  setStatus('reconnecting');
  void client.forceDisconnect();
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
