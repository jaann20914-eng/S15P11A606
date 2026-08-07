import { router } from 'expo-router';

/**
 * 같은 이동을 짧은 사이에 두 번 실행하지 않게 막는 전역 가드.
 *
 * 버튼을 빠르게 두 번 누르면 손가락이 떨어지기 전 화면이 바뀌지 않아 onPress가 두 번
 * 발화하고, 같은 화면이 두 장 쌓인다(카드 → 상세, 목록 → 채팅방, 헤더 뒤로 가기 등
 * **이동하는 모든 버튼**이 같은 문제를 겪는다). 버튼마다 잠금 상태를 두는 대신, 모든
 * 화면이 공유하는 `router` 싱글턴의 메서드를 한 곳에서 감싼다 — 이 앱의 이동은 전부
 * `router.*`를 지나므로(Link 미사용, 2026-08-07 전수 확인) 이 한 겹이 앱 전체를 덮는다.
 *
 * **막는 것은 "같은 이동의 반복"뿐이다.** 메서드와 인자가 완전히 같은 호출이 짧은 창
 * 안에 다시 오면 무시한다. 시간만으로 전부 잠그지 않는 이유: 등록 완료가
 * `replace(홈)` 직후 `push(상세)`를 연달아 부르는 것처럼, **서로 다른 이동을 잇따라
 * 부르는 정당한 코드**가 있다. 그런 흐름은 인자가 다르므로 그대로 지나간다.
 *
 * `back`·`dismiss`처럼 인자가 없는 메서드도 같은 규칙으로 묶인다 — 뒤로 가기를 창 안에
 * 두 번 누르면 한 번만 실행된다. 0.7초 안에 두 화면을 의도적으로 되감는 조작보다,
 * 더블 탭으로 한 장이 더 닫히는 사고가 압도적으로 흔해서 막는 쪽을 택했다.
 */

/**
 * 반복으로 보는 시간(ms). 화면 전환 애니메이션(250~350ms)이 끝나고 손가락이 한 번 더
 * 닿을 여유까지 덮되, "안 눌린다"고 느낄 만큼 길지는 않게.
 */
const REPEAT_WINDOW_MS = 700;

let lastKey = '';
let lastAt = 0;

/** 대상 메서드가 이동시키려는 곳까지 포함해 "같은 호출"인지 가리는 열쇠. */
function callKey(name: string, args: unknown[]): string {
  try {
    return `${name}:${JSON.stringify(args)}`;
  } catch {
    // 직렬화가 안 되는 인자(순환 참조 등)는 이 앱에 없지만, 있더라도 막지는 않는다.
    return `${name}:${Date.now()}`;
  }
}

function guarded<T extends (...args: never[]) => unknown>(name: string, method: T): T {
  return ((...args: never[]) => {
    const key = callKey(name, args);
    const now = Date.now();

    if (key === lastKey && now - lastAt < REPEAT_WINDOW_MS) return undefined;

    lastKey = key;
    lastAt = now;
    return method(...args);
  }) as T;
}

/** 테스트가 케이스마다 깨끗한 창에서 시작하도록 기억을 비운다. 앱 코드에서는 부르지 않는다. */
export function resetNavigationGuardMemory(): void {
  lastKey = '';
  lastAt = 0;
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

  router.navigate = guarded('navigate', router.navigate);
  router.push = guarded('push', router.push);
  router.replace = guarded('replace', router.replace);
  router.back = guarded('back', router.back);
  router.dismiss = guarded('dismiss', router.dismiss);
  router.dismissTo = guarded('dismissTo', router.dismissTo);
  router.dismissAll = guarded('dismissAll', router.dismissAll);
}
