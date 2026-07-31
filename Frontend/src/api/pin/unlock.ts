import { apiRequest } from '../client';
import { usesMock } from '../config';
import { unlockMockPin } from '@/mocks/pin';
import type { PinUnlockResult } from '@/types/pin';

/**
 * 영상 잠금 해제(크레딧 결제) — `POST /api/v1/pins/{pinId}/unlock`
 *
 * `Idempotency-Key`가 필수다. 같은 결제의 재시도에는 같은 키를 그대로 다시 보내야
 * 중복 차감이 일어나지 않는다. 키 생성·보관은 호출부(`usePinDetailScreen`) 책임이다.
 *
 * 오류 코드: `INVALID_PIN_ID` `IDEMPOTENCY_KEY_REQUIRED` `UNAUTHORIZED` `PIN_NOT_FOUND`
 * `IDEMPOTENCY_KEY_CONFLICT` `INSUFFICIENT_CREDIT` `PIN_UNLOCK_FAILED` `VIDEO_URL_ISSUE_FAILED`.
 */
function requestUnlockPin(pinId: number, idempotencyKey: string): Promise<PinUnlockResult> {
  return apiRequest<PinUnlockResult>({
    method: 'POST',
    url: `/api/v1/pins/${pinId}/unlock`,
    headers: { 'Idempotency-Key': idempotencyKey },
  });
}

export function unlockPin(pinId: number, idempotencyKey: string): Promise<PinUnlockResult> {
  return usesMock('pin/unlock') ? unlockMockPin(pinId, idempotencyKey) : requestUnlockPin(pinId, idempotencyKey);
}
