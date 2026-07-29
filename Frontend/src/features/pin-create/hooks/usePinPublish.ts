import { useCallback, useState } from 'react';
import { ApiError } from '@/api/client';
import { createPin } from '@/api/pin/create';
import { getCrowdLevelByValue } from '@/constants/crowdLevels';
import type { PinCreateRequest, PinDraft, PinProcessingStatus } from '@/types/pinCreate';

export interface PinPublish {
  /** 등록 요청을 보내는 중. 이 동안 진행 화면에 머문다. */
  publishing: boolean;
  /** 접수된 핀. 202를 받으면 채워진다. */
  pinId: number | null;
  status: PinProcessingStatus | null;
  error: string | null;
  publish: (draft: PinDraft) => void;
  /** 실패 문구를 지우고 작성 화면으로 돌아간다. */
  dismissError: () => void;
}

/**
 * 촬영 좌표.
 *
 * 서버가 선택한 장소와 20m 이내인지 검증한다. 촬영 시점 좌표를 따로 들고 있지 않아
 * 지금은 선택한 장소의 좌표를 쓴다. 같은 자리에서 찍고 고르는 흐름이라 실제와 큰 차이가
 * 없지만, 촬영 시점 좌표를 기록해 두는 편이 정확하다.
 */
function toRequest(draft: PinDraft): PinCreateRequest | null {
  if (!draft.video || !draft.place) return null;

  const memo = draft.memo.trim();
  const detailLocation = draft.detailLocation.trim();

  return {
    videoUrl: draft.video.uri,
    // 검색 결과는 카카오 장소 식별자(문자열)를 준다. 서버가 요구하는 내부 placeId(숫자)로
    // 바꿔 줄 경로가 아직 없어 임시로 숫자 변환만 한다. 백엔드 확인이 필요하다.
    placeId: Number(draft.place.kakaoPlaceId),
    latitude: draft.place.latitude,
    longitude: draft.place.longitude,
    crowdLevel: getCrowdLevelByValue(draft.crowdLevel).key,
    // 선택 항목은 비어 있으면 보내지 않는다.
    ...(detailLocation ? { detailLocation } : {}),
    ...(memo ? { memo } : {}),
    ...(draft.tags.length > 0 ? { tags: draft.tags } : {}),
  };
}

/** 오류 코드별 안내. 사용자가 다음에 무엇을 해야 하는지가 다르다. */
const messageByCode: Record<string, string> = {
  LOCATION_OUT_OF_RANGE: '선택한 장소와 촬영 위치가 너무 멀어요. 가까운 장소를 골라 주세요.',
  VIDEO_NOT_ACCESSIBLE: '영상을 올리지 못했어요. 다시 촬영해 주세요.',
  PLACE_NOT_FOUND: '선택한 장소를 찾을 수 없어요. 다시 검색해 주세요.',
  INVALID_CROWD_LEVEL: '혼잡 단계를 다시 선택해 주세요.',
  AI_REQUEST_FAILED: '영상 처리 요청에 실패했어요. 잠시 후 다시 시도해 주세요.',
  PIN_CREATE_FAILED: '핀 등록에 실패했어요. 잠시 후 다시 시도해 주세요.',
};

/**
 * 핀 등록 요청.
 *
 * 서버는 202로 접수만 하고 AI 블러 처리는 비동기로 돈다. 완료를 알 수 있는 경로가 아직
 * 없어 MVP에서는 접수 후 진행 화면에 머문다.
 */
export function usePinPublish(): PinPublish {
  const [publishing, setPublishing] = useState(false);
  const [pinId, setPinId] = useState<number | null>(null);
  const [status, setStatus] = useState<PinProcessingStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const publish = useCallback((draft: PinDraft) => {
    const body = toRequest(draft);
    if (!body) return;

    setPublishing(true);
    setError(null);

    createPin(body)
      .then((result) => {
        setPinId(result.pinId);
        setStatus(result.status);
      })
      .catch((cause: unknown) => {
        setPublishing(false);

        if (cause instanceof ApiError) {
          setError(messageByCode[cause.code] ?? cause.message);
          return;
        }

        setError('핀을 등록하지 못했어요');
      });
  }, []);

  return {
    publishing,
    pinId,
    status,
    error,
    publish,
    dismissError: useCallback(() => setError(null), []),
  };
}
