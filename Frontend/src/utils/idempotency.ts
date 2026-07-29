/**
 * 결제 중복 방지용 멱등성 키를 만든다.
 *
 * 명세상 타입은 그냥 `string`이다(UUID 아님).
 * 서버가 `userId + 키` 조합으로 요청을 식별하므로 전역 유일성까지는 필요 없고
 * "새 결제마다 새 값, 같은 결제의 재시도에는 같은 값"만 지키면 된다.
 *
 * 시각과 난수를 조합해 플랫폼과 무관하게 같은 형식을 쓴다.
 */
export function createIdempotencyKey(): string {
  const time = Date.now().toString(36);
  const random = `${randomSegment()}${randomSegment()}${randomSegment()}`;

  return `${time}-${random}`;
}

function randomSegment(): string {
  return Math.random().toString(36).slice(2, 10);
}
