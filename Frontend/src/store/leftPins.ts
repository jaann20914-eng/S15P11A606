import type { PinId } from '@/types/pin';

/**
 * 이번 실행에서 "이미 떠났어요"를 누른 핀.
 *
 * 판정의 원본은 이제 서버가 준다 — 핀 상세와 채팅 핀 목록의 `publisherStatus`(2026-08-06
 * 추가). 이 기억은 그 값이 닿지 않는 빈틈을 받친다: 떠난 직후 응답을 다시 받기 전의 화면,
 * 그리고 아직 그 값을 주지 않는 서버(배포 전).
 *
 * "방이 전부 CLOSED"로는 판정할 수 없다 — 목록 계약이 거절(REFUSED)과 떠남(LEFT)을 CLOSED
 * 하나로 합쳐 줘서, 요청 하나를 거절만 해도 글이 떠난 것처럼 보였다(2026-08-05). 거절된
 * 글은 새 요청을 계속 받을 수 있는 살아 있는 글이다.
 */
const leftPinIds = new Set<PinId>();

export function markPinLeft(pinId: PinId): void {
  leftPinIds.add(pinId);
}

export function isPinLeft(pinId: PinId): boolean {
  return leftPinIds.has(pinId);
}
