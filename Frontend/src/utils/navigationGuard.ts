import { router } from 'expo-router';
import { store } from 'expo-router/build/global-state/router-store';

/**
 * 같은 화면이 두 번 쌓이지 않게 막는 전역 가드.
 *
 * 버튼을 두 번 누르면 손가락이 떨어지기 전 화면이 바뀌지 않아 onPress가 두 번 발화하고,
 * 같은 화면이 두 장 쌓인다(카드 → 상세, 목록 → 채팅방 등 **이동하는 모든 버튼**이 같은
 * 문제를 겪는다). 버튼마다 잠금 상태를 두는 대신, 모든 화면이 공유하는 `router` 싱글턴의
 * 메서드를 한 곳에서 감싼다 — 이 앱의 이동은 전부 `router.*`를 지나므로(`Link`도
 * `useRouter`도 쓰지 않는다, 2026-08-07 전수 확인) 이 한 겹이 앱 전체를 덮는다.
 *
 * 막는 방법은 둘이다.
 *
 * 1. **이미 그 화면에 있으면 열지 않는다**(`push`). 지금 맨 위 화면과 가려는 곳이 같으면
 *    무시한다. 시간을 보지 않으므로 **얼마나 천천히 눌러도** 두 장이 되지 않는다.
 * 2. **같은 이동의 짧은 반복을 무시한다.** 1번이 닿지 않는 것들(`back`·`dismiss`처럼
 *    목적지가 없는 이동)을 위한 그물이다.
 *
 * 처음에는 2번만 두었는데 실기기에서 계속 두 장이 쌓였다(2026-08-07). 전환이 끝나기까지
 * 0.7초보다 오래 걸리는 자리에서는 두 번째 누름이 창 밖이라 그대로 통과했고, 사용자는
 * 화면이 안 바뀌니 오히려 더 늦게 한 번 더 누른다. 시간으로 재는 한 새는 자리가 남아,
 * 목적지를 보는 1번을 주된 규칙으로 두었다.
 *
 * **모든 이동을 시간으로 잠그지는 않는다.** 등록 완료가 `replace(홈)` 직후 `push(상세)`를
 * 부르는 것처럼 서로 다른 이동을 잇따라 부르는 정당한 코드가 있어서다.
 */

/**
 * 반복으로 보는 시간(ms). 화면 전환 애니메이션(250~350ms)이 끝나고 손가락이 한 번 더
 * 닿을 여유까지 덮되, "안 눌린다"고 느낄 만큼 길지는 않게.
 */
const REPEAT_WINDOW_MS = 700;

/**
 * 최근에 지나간 이동들. 열쇠마다 마지막으로 실행한 시각을 담는다.
 *
 * **하나만 기억하면 안 된다.** 처음에는 "마지막 호출" 한 건만 들고 있었는데, 그 사이 다른
 * 이동이 한 번이라도 끼면 앞선 기록이 지워져 두 번째 누름이 그대로 통과했다 — 화면을 여는
 * 동안 그 화면이 또 다른 이동을 부르는 경우가 있어서(추천에서 핀을 두 번 눌렀을 때 상세가
 * 두 장 쌓였다, 2026-08-07 실기기), 각 이동을 따로 기억해야 한다.
 */
const lastCallAt = new Map<string, number>();

/** 대상 메서드가 이동시키려는 곳까지 포함해 "같은 호출"인지 가리는 열쇠. */
function callKey(name: string, args: unknown[]): string {
  try {
    return `${name}:${JSON.stringify(args)}`;
  } catch {
    // 직렬화가 안 되는 인자(순환 참조 등)는 이 앱에 없지만, 있더라도 막지는 않는다.
    return `${name}:${Date.now()}`;
  }
}

/** 창이 지난 기록을 버린다. 앱이 사는 동안 열쇠가 끝없이 쌓이지 않게 한다. */
function forgetExpired(now: number): void {
  for (const [key, at] of lastCallAt) {
    if (now - at >= REPEAT_WINDOW_MS) lastCallAt.delete(key);
  }
}

/**
 * 가려는 곳의 경로. 알아낼 수 없으면 null.
 *
 * 문자열이면 물음표 앞까지가 경로다. 객체로 주는 경우(`{ pathname, params }`)는 그 칸을
 * 그대로 쓴다. 그 밖의 모양은 판단하지 않고 넘긴다 — 못 알아본다고 이동을 막으면 안 된다.
 */
function targetPathname(href: unknown): string | null {
  if (typeof href === 'string') return href.split('?')[0];

  if (typeof href === 'object' && href !== null && 'pathname' in href) {
    const { pathname } = href as { pathname?: unknown };

    return typeof pathname === 'string' ? pathname : null;
  }

  return null;
}

/** 지금 맨 위에 있는 화면의 경로. 라우터가 아직 준비되지 않았으면 null. */
function currentPathname(): string | null {
  try {
    return store.getRouteInfo().pathname;
  } catch {
    return null;
  }
}

/**
 * 이미 그 화면에 있는데 또 열려는 것인지.
 *
 * 경로에 값이 박혀 있으므로(`/pin/{id}`) 다른 핀을 여는 것은 걸리지 않는다. 같은 핀을
 * 두 번 누르는 경우만 걸린다.
 */
function alreadyThere(args: never[]): boolean {
  const target = targetPathname(args[0]);
  const current = currentPathname();

  return target !== null && current !== null && target === current;
}

function guarded<T extends (...args: never[]) => unknown>(
  name: string,
  method: T,
  { skipWhenAlreadyThere = false } = {},
): T {
  return ((...args: never[]) => {
    if (skipWhenAlreadyThere && alreadyThere(args)) return undefined;

    const key = callKey(name, args);
    const now = Date.now();
    const previous = lastCallAt.get(key);

    if (previous !== undefined && now - previous < REPEAT_WINDOW_MS) return undefined;

    forgetExpired(now);
    lastCallAt.set(key, now);
    return method(...args);
  }) as T;
}

/** 테스트가 케이스마다 깨끗한 창에서 시작하도록 기억을 비운다. 앱 코드에서는 부르지 않는다. */
export function resetNavigationGuardMemory(): void {
  lastCallAt.clear();
}

let installed = false;

/**
 * 가드를 설치한다. 루트 레이아웃 모듈이 로드될 때 한 번 부른다.
 *
 * `router`는 expo-router가 만들어 두는 단 하나의 객체고 모든 import가 같은 참조를
 * 받으므로, 여기서 메서드를 바꿔 끼우면 모든 호출처에 적용된다.
 */
export function installNavigationGuard(): void {
  if (installed) return;
  installed = true;

  /*
    `push`만 목적지를 본다. 스택에 한 장을 더 얹는 유일한 이동이라, 같은 화면이 두 장
    쌓이는 사고가 여기서만 난다. `navigate`는 이미 있는 화면으로 돌아가는 쪽이고
    `replace`는 장수를 늘리지 않는다.
  */
  router.navigate = guarded('navigate', router.navigate);
  router.push = guarded('push', router.push, { skipWhenAlreadyThere: true });
  router.replace = guarded('replace', router.replace);
  router.back = guarded('back', router.back);
  router.dismiss = guarded('dismiss', router.dismiss);
  router.dismissTo = guarded('dismissTo', router.dismissTo);
  router.dismissAll = guarded('dismissAll', router.dismissAll);
}
