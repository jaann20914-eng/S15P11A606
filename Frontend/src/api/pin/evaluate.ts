import { apiRequest } from '../client';
import { usesMockApi } from '../config';
import { evaluateMockPin } from '@/mocks/pin';
import type { PinEvaluationResult, PinRating } from '@/types/pin';

/**
 * 핀 평가 등록 — `POST /api/v1/pins/{pinId}/evaluations`
 *
 * 열람 권한이 있는 사용자만, 핀당 한 번만 가능하다. 작성자는 본인 핀을 평가할 수 없다.
 * 정상 평가 시 1 크레딧이 지급되고 작성자 뷰 각도가 함께 조정된다.
 *
 * 오류 코드: `INVALID_PIN_ID` `INVALID_RATING` `UNAUTHORIZED`
 * `PIN_EVALUATION_FORBIDDEN` `PIN_NOT_FOUND` `PIN_ALREADY_EVALUATED` `PIN_EVALUATION_FAILED`.
 */
function requestEvaluatePin(pinId: number, rating: PinRating): Promise<PinEvaluationResult> {
  return apiRequest<PinEvaluationResult>({
    method: 'POST',
    url: `/api/v1/pins/${pinId}/evaluations`,
    data: { rating },
  });
}

export function evaluatePin(pinId: number, rating: PinRating): Promise<PinEvaluationResult> {
  return usesMockApi ? evaluateMockPin(pinId, rating) : requestEvaluatePin(pinId, rating);
}
