import { apiRequest } from '../client';
import { usesMock } from '../config';
import { unlockMockPin } from '@/mocks/pin';
import { usePinAccessStore } from '@/store/usePinAccessStore';
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

/**
 * 결제 결과를 화면들이 함께 보는 자리에 적는다.
 *
 * **부르는 쪽이 아니라 여기서 적는다.** 결제 성공을 아는 화면은 게시글 상세 하나지만 그 결과를
 * 알아야 하는 화면은 여럿이다(장소 상세의 카드 썸네일). 호출부에 맡기면 새 화면이 결제를
 * 붙일 때마다 잊을 수 있고, 잊으면 "구매했는데 아직 가려져 있다"로 나타난다.
 *
 * 200이면 권한을 얻은 것이다 — `accessGranted`는 성공 시 항상 true이고, 기존 구매자·작성자가
 * 다시 불러도(차감 0) 마찬가지다.
 */
async function unlockAndRemember(pinId: PinId, idempotencyKey: string): Promise<PinUnlockResult> {
  const result = usesMock('pin/unlock')
    ? await unlockMockPin(pinId, idempotencyKey)
    : await requestUnlockPin(pinId, idempotencyKey);

  usePinAccessStore.getState().markUnlocked(pinId);
  return result;
}

export function unlockPin(pinId: PinId, idempotencyKey: string): Promise<PinUnlockResult> {
  return tracePin(
    '영상 열람 결제',
    'pin/unlock',
    () => unlockAndRemember(pinId, idempotencyKey),
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
