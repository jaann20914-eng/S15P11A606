import { useCallback, useRef, useState } from 'react';
import { router } from 'expo-router';
import { ApiError } from '@/api/client';
import { confirmPlaceSearch } from '@/api/place/searchConfirm';
import { useMapStore } from '@/store/useMapStore';
import { createDevLogger, toRequestLine } from '@/utils/devLog';
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

const log = createDevLogger('place-confirm');

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
 * - **미등록 장소**(`placeId`가 `null`) — 갈 상세가 없다. 오류가 아니라 아직 아무도 핀을 남기지
 *   않은 장소라는 뜻이라, 같은 구성의 "핀이 없는 장소" 화면으로 보낸다.
 *
 * 상세로 보낼 때 검색 화면을 **먼저 닫는다.** 장소 상세는 루트의 반투명 모달이라 그 아래
 * 화면이 그대로 비치는데, 검색 화면이 앞에 남아 있으면 지도 대신 흰 배경이 비친다. 두 명령을
 * 잇달아 부르는 것은 안전하다 — expo-router가 액션을 큐에 쌓아 순서대로 넘긴다.
 */
export function usePlaceConfirm(): PlaceConfirmState {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const focusOn = useMapStore((state) => state.focusOn);

  /**
   * 답을 기다리는 중인지. **`pendingId`가 아니라 ref로 본다.**
   *
   * 상태는 다음 렌더에나 반영되므로, 같은 줄을 연달아 누르면 두 번째 누름이 아직 `null`인 값을
   * 보고 그대로 통과한다. 그러면 확정이 두 번 나가고 **같은 장소 상세가 두 겹 쌓인다.**
   *
   * 겹이 둘이면 그 화면들이 한 지도를 두고 다툰다 — 저장소로 고른 핀을 주고받으므로 위 겹이
   * 고른 핀을 아래 겹이 자기 번호로 옮기고, 그 번호가 다시 지도 이동 요청이 되어 카드가 저절로
   * 넘어가다 렌더가 끝나지 않았다(2026-08-05 실기기). 그쪽은 화면에서도 막았지만
   * (`app/place/[placeId]`의 `onTop`), **애초에 두 겹이 생기지 않는 것이 먼저다.**
   */
  const running = useRef(false);

  const confirm = useCallback(
    (kakaoPlaceId: string, placeName: string, coordinate?: Coordinate) => {
      if (running.current) {
        log('중복 눌림 — 무시', { kakaoPlaceId, placeName });
        return;
      }
      running.current = true;

      setPendingId(kakaoPlaceId);
      setNotice(null);

      const startedAt = Date.now();
      log('요청', {
        재현: toRequestLine('POST', `/api/v1/places/search/${kakaoPlaceId}`),
        본문: { placeName },
        지도이동: coordinate === undefined ? '좌표 없음(기록에서 고름)' : '고른 항목의 좌표 사용',
      });

      confirmPlaceSearch(kakaoPlaceId, placeName)
        .then(({ place, pins, weeklyCrowdStats }) => {
          setPendingId(null);
          log('응답', {
            placeId: place.placeId ?? '없음(미등록 장소)',
            이름: place.name,
            핀: pins.length,
            통계요일: weeklyCrowdStats.length,
            소요: `${Date.now() - startedAt}ms`,
            // 메모 없는 핀이 실제로 오는지. 예전에 이걸 못 다뤄 목록이 죽었다.
            메모없는핀: pins.filter((pin) => pin.memo === null).length,
          });

          /*
            아직 핀이 없는 장소. **안내 한 줄로 멈추지 않고 그 장소를 보여준다.**

            예전에는 검색 화면에 "아직 등록된 핀이 없어요"만 띄우고 멈췄다. 사용자가 찾은
            것은 분명히 있는 장소인데 화면은 검색 목록 그대로여서, 찾은 자리가 어디인지도 다음에
            무엇을 할 수 있는지도 알 수 없었다. 이제 장소 상세와 같은 구성의 화면으로 보내
            지도에서 그 자리를 보여주고 첫 핀을 남기도록 부른다(`app/place/no-pins.tsx`).

            상세로 보낼 때와 같은 이유로 검색 화면을 먼저 닫는다 — 그 화면도 홈 위의 반투명
            모달이라, 검색 화면이 앞에 남아 있으면 지도 대신 흰 배경이 비친다.
          */
          if (place.placeId === null) {
            log('이동 — 미등록 장소', { 이름: place.name, 경로: '/place/no-pins' });
            router.back();
            router.push({
              pathname: '/place/no-pins',
              /*
                갈 상세가 없어 다시 물어볼 곳도 없다. 확정 응답이 준 이름과 주소를 그대로 넘긴다.

                **지도를 옮기는 일은 그 화면이 한다.** 여기서 먼저 옮기면 장소 축척으로 한 번,
                그 화면이 20m로 또 한 번 명령이 가서 확대가 두 번 끊겨 보인다. 좌표를 아는
                경로에서는 그 값을 실어 보내고, 모르면 그 화면이 이름으로 다시 찾는다
                (`useSearchedPlaceFocus`).
              */
              params: {
                name: place.name,
                address: place.address,
                kakaoPlaceId,
                ...(coordinate === undefined
                  ? null
                  : { latitude: coordinate.latitude, longitude: coordinate.longitude }),
              },
            });
            return;
          }

          // 좌표는 확정 응답에 없다. 고른 검색 결과가 가지고 있던 값을 그대로 쓴다.
          if (coordinate) focusOn({ coordinate, name: place.name });

          log('이동', { 경로: `/place/${place.placeId}` });
          router.back();
          router.push(`/place/${place.placeId}`);
        })
        .catch((cause: unknown) => {
          /*
            **실패했을 때만 자물쇠를 푼다.** 성공하면 화면을 옮기는 중이라 다시 누를 이유가 없고,
            푸는 순간 그 사이에 들어온 두 번째 누름이 통과해 같은 화면이 또 쌓인다. 이 화면은
            곧 사라지므로 잠긴 채로 두는 것이 맞다.
          */
          running.current = false;
          setPendingId(null);
          log('실패', {
            code: cause instanceof ApiError ? cause.code : 'unknown',
            statusCode: cause instanceof ApiError ? cause.statusCode : undefined,
            message: cause instanceof Error ? cause.message : String(cause),
            소요: `${Date.now() - startedAt}ms`,
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
