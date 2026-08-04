import { createUuid } from './uuid';

/**
 * 결제 중복 방지용 멱등성 키를 만든다.
 *
 * **UUID여야 한다.** 명세에는 타입이 `string`으로만 적혀 있어 시각+난수를 조합한 자유 형식으로
 * 보냈는데, 서버는 이 헤더를 `UUID.fromString`으로 파싱하고 실패하면 `INVALID_IDEMPOTENCY_KEY`
 * (400)로 막는다. 결제가 시작되지도 못했다(2026-08-05).
 *
 * 서버가 `userId + 키` 조합으로 요청을 식별하므로 전역 유일성까지는 필요 없고
 * "새 결제마다 새 값, 같은 결제의 재시도에는 같은 값"만 지키면 된다.
 */
export function createIdempotencyKey(): string {
  return createUuid();
}
