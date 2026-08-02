/**
 * 액세스 토큰(JWT)의 만료 시각을 읽는다.
 *
 * **검증이 아니다.** 서명을 확인하지 않으므로 이 값으로 권한을 판단하면 안 된다. 쓰는 곳은
 * 하나다 — 어차피 거절당할 요청을 보내기 전에 미리 토큰을 갱신할지 정하는 것.
 *
 * REST는 401을 받고 갱신하면 되지만 WebSocket은 그 흐름이 없다. 만료된 토큰으로 CONNECT하면
 * 서버가 끊고, 우리는 그것을 "연결이 끊겼다"로 보고 같은 토큰으로 다시 두드리게 된다.
 */

/**
 * 이만큼 남았으면 만료로 친다(ms).
 *
 * 딱 맞춰 보내면 서버에 닿는 사이에 넘어갈 수 있고, 기기 시계가 조금 빠르거나 느릴 수도 있다.
 */
const EXPIRY_MARGIN_MS = 30_000;

/** 만료 시각(ms). 형식이 JWT가 아니거나 `exp`가 없으면 null. */
export function readTokenExpiry(token: string): number | null {
  const payload = token.split('.')[1];

  if (payload === undefined) return null;

  try {
    const decoded: unknown = JSON.parse(decodeBase64Url(payload));

    if (typeof decoded === 'object' && decoded !== null && 'exp' in decoded) {
      const { exp } = decoded as { exp?: unknown };

      // `exp`는 초 단위다.
      return typeof exp === 'number' ? exp * 1000 : null;
    }
  } catch {
    // 우리가 아는 형식이 아니면 판단하지 않는다.
  }

  return null;
}

/**
 * 지금 쓰기에 이미 늦은 토큰인지.
 *
 * 만료 시각을 알 수 없으면 **거짓**을 돌려준다. 읽지 못했다는 이유로 멀쩡한 토큰을 버리고
 * 갱신을 부르면, 형식이 조금 다른 서버에서 매번 재발급이 돈다.
 */
export function isTokenExpired(token: string | null): boolean {
  if (token === null) return true;

  const expiry = readTokenExpiry(token);

  if (expiry === null) return false;

  return expiry - EXPIRY_MARGIN_MS <= Date.now();
}

/** JWT의 base64url 부분을 문자열로 되돌린다. */
function decodeBase64Url(value: string): string {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');

  return globalThis.atob(padded);
}
