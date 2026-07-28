import { apiRequest } from './client';
import {
  deleteMockPin,
  fetchMockPinDetail,
  leaveMockPinChats,
  unlockMockPin,
} from '@/mocks/pinDetail';
import { toCrowdLevelKey } from '@/types/pin';
import type { PinDetail, PinDetailResponse, PinUnlockResult } from '@/types/pin';

/**
 * 고정 데이터를 쓸지 여부.
 * `EXPO_PUBLIC_API_BASE_URL`이 비어 있으면 별도 설정 없이 목업으로 동작한다.
 */
export const usesMockApi =
  process.env.EXPO_PUBLIC_USE_MOCK_API === 'true' || !process.env.EXPO_PUBLIC_API_BASE_URL;

/**
 * 게시글 상세 조회.
 *
 * 응답 필드는 상세 조회 명세를 그대로 따른다(`PinDetail` 참고).
 * 오류 코드: `INVALID_PIN_ID` `UNAUTHORIZED` `PIN_NOT_FOUND`
 * `PIN_DETAIL_FETCH_FAILED` `VIDEO_URL_ISSUE_FAILED`.
 *
 * 응답 구조가 달라지면 이 함수 안에서 변환해 화면 쪽 변경을 막는다.
 */
function requestPinDetail(pinId: number): Promise<PinDetailResponse> {
  return apiRequest<PinDetailResponse>({ method: 'GET', url: `/api/v1/pins/${pinId}` });
}

/** 서버 응답을 화면이 쓰는 모양으로 바꾼다. 지금은 혼잡 단계 enum 하나만 다르다. */
function toPinDetail(response: PinDetailResponse): PinDetail {
  return { ...response, crowdLevel: toCrowdLevelKey(response.crowdLevel) };
}

export async function getPinDetail(pinId: number): Promise<PinDetail> {
  const response = usesMockApi ? await fetchMockPinDetail(pinId) : await requestPinDetail(pinId);
  return toPinDetail(response);
}

/**
 * 영상 잠금 해제(크레딧 결제).
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
  return usesMockApi ? unlockMockPin(pinId, idempotencyKey) : requestUnlockPin(pinId, idempotencyKey);
}

/** 내가 쓴 게시글 삭제. 작성자가 아니면 서버가 403을 준다. */
async function requestDeletePin(pinId: number): Promise<void> {
  await apiRequest<null>({ method: 'DELETE', url: `/api/v1/pins/${pinId}` });
}

export function deletePin(pinId: number): Promise<void> {
  return usesMockApi ? deleteMockPin(pinId) : requestDeletePin(pinId);
}

/**
 * "이미 떠났어요" — 핀에 연결된 모든 채팅방을 LEFT로 바꾼다.
 * 핀 자체와 크레딧 거래는 그대로 두므로 삭제와 다르다.
 */
async function requestLeavePinChats(pinId: number): Promise<number[]> {
  const data = await apiRequest<{ leftChatRoomIds: number[] }>({
    method: 'POST',
    url: `/api/v1/chat/pins/${pinId}/rooms/leave`,
  });
  return data.leftChatRoomIds;
}

export function leavePinChats(pinId: number): Promise<number[]> {
  return usesMockApi ? leaveMockPinChats(pinId) : requestLeavePinChats(pinId);
}
