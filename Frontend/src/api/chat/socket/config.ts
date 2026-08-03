import { apiBaseUrl } from '@/constants/env';

/**
 * WebSocket 핸드셰이크 경로.
 *
 * 서버가 `registerStompEndpoints`에 등록한 값과 같아야 한다(`WebSocketConfig`).
 *
 * `/api` 아래에 둔다. nginx가 그 경로만 백엔드로 넘기고 있어서, 밖에 두면 요청이 서버에
 * 닿지도 않는다.
 */
const SOCKET_PATH = '/api/ws';

/** 서버가 요구하는 STOMP 버전. 다른 값을 보내면 `UNSUPPORTED_STOMP_VERSION`으로 끊긴다. */
export const STOMP_VERSION = '1.2';

/** 하트비트 주기(ms). 명세 기본값 `10000,10000`과 같다. */
export const HEARTBEAT_MS = 10_000;

/**
 * 재연결 간격(ms).
 *
 * 명세의 권장값이다. 끊기자마자 짧은 간격으로 계속 두드리면 서버가 살아나는 순간 모든
 * 클라이언트가 한꺼번에 몰린다. 마지막 값에 도달하면 그 간격을 유지한다.
 */
export const RECONNECT_DELAYS_MS = [1_000, 2_000, 5_000, 10_000];

/**
 * 접속할 WebSocket 주소.
 *
 * REST와 같은 호스트를 쓰므로 `http`를 `ws`로 바꿔 만든다. 주소가 비어 있으면(목업 모드)
 * 빈 문자열을 돌려주고, 연결을 시도하는 쪽에서 이 값을 보고 멈춘다.
 */
export function resolveSocketUrl(): string {
  if (apiBaseUrl === '') return '';

  const origin = apiBaseUrl.replace(/\/+$/, '');

  return `${origin.replace(/^http/, 'ws')}${SOCKET_PATH}`;
}

/** 서버에 붙을 수 있는 환경인지. 주소가 없으면 소켓 기능 전체를 끈다. */
export const canUseSocket = resolveSocketUrl() !== '';
