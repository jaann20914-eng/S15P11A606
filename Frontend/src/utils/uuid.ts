/**
 * UUID v4 문자열.
 *
 * 서버가 `UUID` 타입으로 받는 자리에 쓴다(예: 채팅 메시지의 `client_message_id`). 형식이
 * 어긋나면 역직렬화 단계에서 거절되므로 `createIdempotencyKey`의 자유 형식 키는 쓸 수 없다.
 *
 * 기기에 표준 생성기가 있으면 그것을 쓰고, 없으면 난수로 만든다. 여기 쓰이는 값은 같은 메시지의
 * 재시도를 알아보기 위한 것이라 암호학적 강도가 필요하지 않다.
 */
export function createUuid(): string {
  const native = globalThis.crypto;

  if (typeof native?.randomUUID === 'function') return native.randomUUID();

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (placeholder) => {
    const value = Math.floor(Math.random() * 16);
    // 변형 비트: 세 번째 그룹의 첫 자리는 8·9·a·b 중 하나여야 한다.
    const digit = placeholder === 'x' ? value : (value & 0x3) | 0x8;

    return digit.toString(16);
  });
}
