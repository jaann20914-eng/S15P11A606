import { useCallback, useState } from 'react';
import { router } from 'expo-router';
import { ApiError } from '@/api/client';
import { confirmPlaceSearch } from '@/api/place/searchConfirm';
import { useMapStore } from '@/store/useMapStore';
import type { Coordinate } from '@/store/useMapStore';

/** 오류 코드별 안내. */
const messageByCode: Record<string, string> = {
  INVALID_PLACE_SEARCH_QUERY: '장소 검색 조건이 올바르지 않아요.',
  UNAUTHORIZED: '로그인이 필요해요.',
  PLACE_NOT_FOUND: '장소를 찾을 수 없어요.',
  EXTERNAL_PLACE_API_ERROR: '장소 정보를 가져오지 못했어요. 잠시 후 다시 시도해 주세요.',
  EXTERNAL_PLACE_API_UNAVAILABLE: '장소 검색 서비스를 사용할 수 없어요. 잠시 후 다시 시도해 주세요.',
  PLACE_DETAIL_FETCH_FAILED: '장소 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.',
};

/** 개발 중 확정 단계가 어디서 끊겼는지 따라갈 수 있게 한다. */
function logConfirm(step: string, detail?: Record<string, unknown>): void {
  if (!__DEV__) return;
  console.log(`[place-confirm] ${step}`, detail ?? '');
}

export interface PlaceConfirmState {
  /** 요청이 도는 동안 어떤 항목을 눌렀는지(`kakaoPlaceId`). 그 줄만 표시를 바꾼다. */
  pendingId: string | null;
  /** 실패나 안내 문구. 없으면 null. */
  notice: string | null;
  dismissNotice: () => void;
  confirm: (kakaoPlaceId: string, placeName: string, coordinate?: Coordinate) => void;
}

/**
 * 고른 장소를 확정한다 — `POST /api/v1/places/search/{kakaoPlaceId}`
 *
 * 검색 결과(`GET /places/search`)는 카카오 장소라 우리 `placeId`가 없다. 이 호출이 그것을
 * 알려 주고, 동시에 서버가 검색 이력을 남긴다(`search_type = PLACE`). 최근 검색기록은 그래서
 * 저절로 쌓인다.
 *
 * **핀 등록과 이어지는 지점이 여기다.** 핀을 등록하면 서버가 `kakaoPlaceId`로 장소를 만들거나
 * 재사용한다(`PinPersistenceService.resolveOrCreatePlace`). 확정은 같은 키로 그 장소를 찾으므로
 * (`placeRepository.findByKakaoPlaceId`), 방금 등록한 핀이 곧바로 검색 결과에 나타난다.
 *
 * 확정 결과에 따라 가는 곳이 다르다.
 *
 * - **등록된 장소** — 장소 상세로 간다. 아래 깔린 홈 지도를 먼저 그 자리로 옮긴다.
 * - **미등록 장소**(`placeId`가 `null`) — 갈 상세가 없다. 지도만 옮기고 왜 멈췄는지 알린다.
 *   오류가 아니라 아직 아무도 핀을 남기지 않은 장소라는 뜻이다.
 *
 * 상세로 보낼 때 검색 화면을 **먼저 닫는다.** 장소 상세는 루트의 반투명 모달이라 그 아래
 * 화면이 그대로 비치는데, 검색 화면이 앞에 남아 있으면 지도 대신 흰 배경이 비친다. 두 명령을
 * 잇달아 부르는 것은 안전하다 — expo-router가 액션을 큐에 쌓아 순서대로 넘긴다.
 */
export function usePlaceConfirm(): PlaceConfirmState {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const focusOn = useMapStore((state) => state.focusOn);

  const confirm = useCallback(
    (kakaoPlaceId: string, placeName: string, coordinate?: Coordinate) => {
      setPendingId(kakaoPlaceId);
      setNotice(null);
      logConfirm('요청', { kakaoPlaceId, placeName });

      confirmPlaceSearch(kakaoPlaceId, placeName)
        .then(({ place, pins }) => {
          setPendingId(null);
          logConfirm('응답', { placeId: place.placeId ?? '없음(미등록 장소)', 핀: pins.length });

          // 좌표는 확정 응답에 없다. 고른 검색 결과가 가지고 있던 값을 그대로 쓴다.
          if (coordinate) focusOn({ coordinate, name: place.name });

          if (place.placeId === null) {
            setNotice(`'${place.name}'에는 아직 등록된 영상핀이 없어요.`);
            return;
          }

          router.back();
          router.push(`/place/${place.placeId}`);
        })
        .catch((cause: unknown) => {
          setPendingId(null);
          logConfirm('실패', {
            code: cause instanceof ApiError ? cause.code : 'unknown',
            message: cause instanceof Error ? cause.message : String(cause),
          });
          setNotice(
            cause instanceof ApiError
              ? (messageByCode[cause.code] ?? cause.message)
              : '장소 정보를 불러오지 못했어요',
          );
        });
    },
    [focusOn],
  );

  return {
    pendingId,
    notice,
    dismissNotice: useCallback(() => setNotice(null), []),
    confirm,
  };
}
