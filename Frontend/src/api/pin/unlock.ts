import { apiRequest } from '../client';
import { usesMock } from '../config';
import { unlockMockPin } from '@/mocks/pin';
import type { PinId, PinUnlockResult } from '@/types/pin';
import { tracePin } from './log';

/**
 * 영상 잠금 해제(크레딧 결제) — `POST /api/v1/pins/{pinId}/unlock`
 *
 * `Idempotency-Key`가 필수다. 같은 결제의 재시도에는 같은 키를 그대로 다시 보내야
 * 중복 차감이 일어나지 않는다. 키 생성·보관은 호출부(`usePinDetailScreen`) 책임이다.
 *
 * 오류 코드: `INVALID_PIN_ID` `IDEMPOTENCY_KEY_REQUIRED` `UNAUTHORIZED` `PIN_NOT_FOUND`
 * `IDEMPOTENCY_KEY_CONFLICT` `INSUFFICIENT_CREDIT` `PIN_UNLOCK_FAILED` `VIDEO_URL_ISSUE_FAILED`.
 */
function requestUnlockPin(pinId: PinId, idempotencyKey: string): Promise<PinUnlockResult> {
  return apiRequest<PinUnlockResult>({
    method: 'POST',
    url: `/api/v1/pins/${pinId}/unlock`,
    headers: { 'Idempotency-Key': idempotencyKey },
  });
}

export function unlockPin(pinId: PinId, idempotencyKey: string): Promise<PinUnlockResult> {
  return tracePin(
    '영상 열람 결제',
    'pin/unlock',
    () =>
      usesMock('pin/unlock')
        ? unlockMockPin(pinId, idempotencyKey)
        : requestUnlockPin(pinId, idempotencyKey),
    (result) => ({
      pinId,
      차감: result.creditCharged,
      잔액: result.creditBalance,
      권한: result.accessGranted,
      // 같은 키로 다시 눌렀는지 알아보려면 이 값이 필요하다(재시도는 차감이 0이다).
      멱등키: idempotencyKey,
    }),
  );
}
