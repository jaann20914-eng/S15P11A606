import type { PinId } from '@/types/pin';

/**
 * 이번 실행에서 "이미 떠났어요"를 누른 핀.
 *
 * 서버 상세 응답에 제보자 상태가 없어(`PinDetailResponse`) 다시 들어왔을 때 서버 값으로는
 * 알 수 없다. 그래서 세션 동안만 기억한다 — 앱을 다시 켜면 비고, 그때 다시 눌러도 서버가
 * 멱등하게 처리한다(`usePinDetailScreen`의 떠나기 주석 참고).
 *
 * 채팅 목록이 글 줄을 연하게 누르는 판정도 이 값을 쓴다. "방이 전부 CLOSED"로는 판정할 수
 * 없다 — 목록 계약이 거절(REFUSED)과 떠남(LEFT)을 CLOSED 하나로 합쳐 줘서, 요청 하나를
 * 거절만 해도 글이 떠난 것처럼 보였다(2026-08-05). 거절된 글은 새 요청을 계속 받을 수 있는
 * 살아 있는 글이다.
 */
const leftPinIds = new Set<PinId>();

export function markPinLeft(pinId: PinId): void {
  leftPinIds.add(pinId);
}

export function isPinLeft(pinId: PinId): boolean {
  return leftPinIds.has(pinId);
}
