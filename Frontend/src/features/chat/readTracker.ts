/**
 * "지금 어느 방을 보고 있는지"와 "어느 방을 읽었는지"를 목록 화면들에 알린다.
 *
 * 채팅방 화면과 목록 화면은 같은 시간에 살아 있다 — 방은 목록 **위에** 쌓이는 라우트라
 * 목록이 내려가지 않는다. 그래서 방 안에서 일어난 읽음이 목록의 안 읽음 점과 어긋나는
 * 순간이 생긴다:
 *
 * - 내가 보고 있는 방에 메시지가 오면, 목록도 같은 이벤트를 받아 점을 켠다. 하지만 나는
 *   그 메시지를 **지금 읽고 있다** — 점이 켜지면 안 된다(카카오톡과 같은 규칙).
 * - 방을 나올 때 목록이 서버를 다시 부르는데, 읽음 갱신(PATCH)이 아직 끝나지 않았으면
 *   방금 읽은 방에 점이 남는다.
 *
 * 이 모듈이 그 어긋남을 지운다. 방 화면이 들어오고 나갈 때와 읽음이 서버에 저장될 때
 * 알려 주면, 목록은 이벤트를 반영할 때 이 값을 보고 점을 결정한다.
 *
 * 스토어를 쓰지 않는 이유: 값이 바뀔 때 화면을 다시 그릴 필요가 없다. 목록은 이벤트가
 * 도착한 **그 순간**의 값만 읽으면 된다.
 */

let activeRoomId: number | null = null;

const readListeners = new Set<(roomId: number) => void>();

/** 방 화면이 열릴 때 부른다. 돌려받은 함수로 닫을 때 지운다. */
export function enterRoom(roomId: number): () => void {
  activeRoomId = roomId;

  return () => {
    // 다른 방이 이미 들어와 있으면 그쪽 것이다. 지우지 않는다.
    if (activeRoomId === roomId) activeRoomId = null;
  };
}

/** 이 방을 지금 사용자가 보고 있는지. 보고 있는 방에는 안 읽음 점을 켜지 않는다. */
export function isRoomOpen(roomId: number): boolean {
  return activeRoomId === roomId;
}

/**
 * 읽음이 서버에 저장됐을 때 부른다.
 *
 * 목록들은 이 신호를 받으면 그 방의 점을 끈다. 서버를 다시 부르지 않고 끄기 때문에,
 * 방을 나온 직후 목록 재조회와 읽음 갱신이 경합해도 점이 남지 않는다.
 */
export function notifyRoomRead(roomId: number): void {
  readListeners.forEach((listener) => listener(roomId));
}

export function onRoomRead(listener: (roomId: number) => void): () => void {
  readListeners.add(listener);

  return () => {
    readListeners.delete(listener);
  };
}
