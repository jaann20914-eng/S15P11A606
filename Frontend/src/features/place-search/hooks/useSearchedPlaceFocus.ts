import { useEffect } from 'react';
import { ApiError } from '@/api/client';
import { searchPlaces } from '@/api/place/search';
import { REVIEW_PIN_MAX_LEVEL } from '@/components/home/kakaoMapHtml';
import { useMapStore } from '@/store/useMapStore';
import { WIDE_PLACE_SEARCH_RADIUS_M } from '@/types/place';
import { createDevLogger } from '@/utils/devLog';
import type { Coordinate } from '@/store/useMapStore';

const log = createDevLogger('searched-place');

export interface SearchedPlaceFocusOptions {
  /** 찾은 장소의 이름. 없으면 아무것도 하지 않는다. */
  name?: string;
  /** 검색 결과에서 들고 온 좌표. 최근 검색으로 들어오면 없다. */
  coordinate?: Coordinate;
  /** 좌표를 다시 찾을 때 같은 장소인지 확인하는 열쇠. */
  kakaoPlaceId?: string;
}

/**
 * 찾아 들어온 장소를 지도 중앙에 20m 축척으로 놓는다.
 *
 * 지도는 홈 것이라 명령만 넘긴다(`useMapStore.focus`). 축척은 영상핀을 볼 때와 같은 최대치로
 * 당긴다 — 이 화면은 "그 자리에 무엇이 있는지" 보러 온 자리이고, 장소 상세와 같은 축척으로
 * 들어와야 두 화면을 오갈 때 지도가 튀지 않는다.
 *
 * **좌표를 모르는 경로가 있다.** 검색 결과에서 고르면 그 항목이 좌표를 갖고 있지만, 최근 검색
 * 기록에는 좌표가 없고(`RecentSearch`) 확정 응답에도 없다(`ConfirmedPlaceSummary`). 그때는
 * 지금 보고 있는 지도 중심을 기준으로 **이름을 한 번 더 검색해** 좌표를 얻는다. 같은 이름이
 * 여럿일 수 있어 `kakaoPlaceId`로 맞춰 고른다.
 *
 * 그 재검색은 반경 20km 안에서만 찾는다(서버 상한). 그보다 먼 곳의 기록이면 좌표를 얻지 못해
 * 지도가 있던 자리에 머문다 — 그때는 왜 못 옮겼는지 로그에 남긴다. 확정 응답이 좌표를 주기
 * 시작하면 이 재검색은 지울 수 있다(백엔드에 요청해 둔 항목).
 *
 * 들어올 때 한 번만 옮긴다. 그 뒤에 사용자가 지도를 끌어 옮긴 자리를 되돌리지 않는다.
 */
export function useSearchedPlaceFocus({ name, coordinate, kakaoPlaceId }: SearchedPlaceFocusOptions): void {
  const focusOn = useMapStore((state) => state.focusOn);

  useEffect(() => {
    if (name === undefined) return;

    if (coordinate !== undefined) {
      focusOn({ coordinate, name, level: REVIEW_PIN_MAX_LEVEL });
      return;
    }

    /* 화면을 떠난 뒤에 도착한 좌표로 지도를 옮기지 않는다. */
    let alive = true;

    /*
      지도 중심은 **효과가 시작될 때 한 번만 읽는다.** 셀렉터로 구독하면 지도가 멈출 때마다
      값이 바뀌어 이 효과가 다시 돌고, 그때마다 같은 곳으로 옮기는 명령이 되풀이된다.
    */
    const center = useMapStore.getState().center;

    searchPlaces(name, center.latitude, center.longitude, WIDE_PLACE_SEARCH_RADIUS_M)
      .then((places) => {
        if (!alive) return;

        const found =
          kakaoPlaceId === undefined
            ? places[0]
            : (places.find((place) => place.kakaoPlaceId === kakaoPlaceId) ?? null);

        if (found === null || found === undefined) {
          log('좌표를 찾지 못해 지도를 옮기지 못함', {
            이름: name,
            결과: places.length,
            사정: '확정 응답에 좌표가 없어 이름으로 다시 찾는다. 반경 20km 밖이면 못 찾는다',
          });
          return;
        }

        focusOn({
          coordinate: { latitude: found.latitude, longitude: found.longitude },
          name,
          level: REVIEW_PIN_MAX_LEVEL,
        });
      })
      .catch((cause: unknown) => {
        log('좌표 재검색 실패', {
          이름: name,
          코드: cause instanceof ApiError ? cause.code : '없음',
        });
      });

    return () => {
      alive = false;
    };
  }, [coordinate, focusOn, kakaoPlaceId, name]);
}
