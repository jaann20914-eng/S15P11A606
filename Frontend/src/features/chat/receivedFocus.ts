import type { PinId } from '@/types/pin';

/**
 * 핀 상세의 "채팅방으로 이동"이 채팅 목록에 넘기는 값.
 *
 * 라우트 param으로 넘겨 봤더니 두 가지가 어긋났다(2026-08-05). 탭 라우트의 param은 화면에
 * 남아 지우는 처리가 따로 필요했고, 그 지움과 목록 조회가 엇갈리면 param만 사라지고 아무
 * 데도 도착하지 못했다. 수정 화면이 쓰는 방식(`editHandoff`)처럼 모듈에 잠깐 두고 받는
 * 쪽이 꺼내 가게 한다 — 한 번 꺼내면 사라지므로 되살아날 일이 없다.
 */
let pendingPinId: PinId | null = null;

/** 채팅 목록이 열리면 이 글의 방 목록까지 바로 들어가라고 남긴다. */
export function focusReceivedPin(pinId: PinId): void {
  pendingPinId = pinId;
}

/** 남겨진 글을 꺼낸다. 꺼내는 순간 지워져 다시 꺼내면 null이다. */
export function consumeReceivedPinFocus(): PinId | null {
  const pinId = pendingPinId;

  pendingPinId = null;

  return pinId;
}
