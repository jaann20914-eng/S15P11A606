import { createStore } from './createStore';
import type { PinId } from '@/types/pin';

/**
 * 이번 실행에서 열람 권한을 얻은 핀.
 *
 * **결제는 한 화면에서 일어나는데 그 결과를 여러 화면이 알아야 한다.** 게시글 상세에서 크레딧을
 * 쓰면 그 화면은 스스로 고쳐 그리지만, 아래에 살아 있는 장소 상세는 결제를 모른다 — 카드
 * 썸네일이 계속 가려진 채로 남고, 돌아와도 풀리지 않았다(2026-08-05). 그 화면은 뒤로 가도
 * 다시 만들어지지 않아 서버에 새로 묻지 않기 때문이다.
 *
 * 그래서 결제 결과를 한곳에 적어 두고 화면들이 함께 본다. 서버의 판정을 대신하지 않는다 —
 * **더해 보는 값**이다. 다시 들어와 새로 물어보면 서버 응답에 이미 열람으로 담겨 온다.
 *
 * 앱을 다시 켜면 비워진다. 서버가 결제 기록을 갖고 있어 되살릴 필요가 없다.
 */
export interface PinAccessState {
  /**
   * 열람 권한을 얻은 핀들.
   *
   * 화면은 이 집합을 그대로 셀렉터로 꺼내 쓴다. 값이 늘 때만 새 집합으로 바뀌므로
   * (`createStore`가 참조로 비교한다) 관계없는 결제에 다시 그려지지 않는다.
   */
  unlockedPinIds: ReadonlySet<PinId>;
  /** 결제가 성공했을 때 적는다. 이미 적혀 있으면 아무 일도 하지 않는다. */
  markUnlocked: (pinId: PinId) => void;
}

export const usePinAccessStore = createStore<PinAccessState>((set, get) => ({
  unlockedPinIds: new Set<PinId>(),
  markUnlocked: (pinId) => {
    const current = get().unlockedPinIds;
    if (current.has(pinId)) return;

    set({ unlockedPinIds: new Set(current).add(pinId) });
  },
}));
