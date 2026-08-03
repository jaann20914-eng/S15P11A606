/**
 * 개발 중 흐름을 터미널에서 따라가기 위한 로그.
 *
 * 검색은 단계가 여러 개다 — 입력 → 디바운스 → 좌표 → 요청 → 응답 → 확정 → 화면 이동. 어디서
 * 끊겼는지 화면만 보고는 알 수 없어서 단계마다 한 줄씩 남긴다.
 *
 * `__DEV__` 안에서만 찍는다. 값에는 **토큰·좌표 같은 민감한 것을 넣지 않는다** — 좌표는 요청을
 * 재현하는 데 필요한 만큼만 요청 한 줄에 들어간다.
 */

export type DevLogger = (step: string, detail?: Record<string, unknown>) => void;

/**
 * 앞에 `[구역]`이 붙는 로거를 만든다.
 *
 * 구역 이름을 그대로 터미널에서 필터링할 수 있다 — 예: `[place-search]`만 보려면 그 문자열로
 * 검색하면 된다. 로거를 곳마다 손으로 만들면 접두사 형식이 조금씩 달라져 이 필터링이 깨진다.
 */
export function createDevLogger(scope: string): DevLogger {
  return (step, detail) => {
    if (!__DEV__) return;

    if (detail === undefined) {
      console.log(`[${scope}] ${step}`);
      return;
    }

    /*
      값이 `undefined`인 항목은 뺀다. 조건이 맞을 때만 적는 항목(예: 0건일 때의 비고)을
      두면 나머지 경우에 `비고: undefined`가 줄마다 찍혀 읽는 데 방해가 된다.
    */
    const kept = Object.entries(detail).filter(([, value]) => value !== undefined);
    console.log(`[${scope}] ${step}`, Object.fromEntries(kept));
  };
}

/**
 * 담당자가 그대로 붙여 재현할 수 있는 요청 한 줄.
 *
 * 파라미터를 로그에 흩어 적으면 읽는 사람이 다시 조립해야 한다. 원인이 서버에 있을 때 가장
 * 빨리 확인하는 방법은 같은 요청을 직접 쏘는 것이므로 완성된 형태로 남긴다.
 *
 * `undefined`·`null`은 뺀다. 서버 기본값을 쓰겠다는 뜻이라 쿼리에 실리지 않아야 한다.
 */
export function toRequestLine(method: string, url: string, params?: Record<string, unknown>): string {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === undefined || value === null) continue;
    query.set(key, String(value));
  }

  const search = query.toString();
  return `${method} ${url}${search.length > 0 ? `?${search}` : ''}`;
}
