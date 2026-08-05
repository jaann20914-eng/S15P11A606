import { useCallback } from 'react';
import { router } from 'expo-router';
import { REVIEW_PIN_MAX_LEVEL } from '@/components/home/kakaoMapHtml';
import { useMapStore } from '@/store/useMapStore';

/**
 * **옆 장소로 돌려 보기.**
 *
 * 20m까지 당기면 그 자리에서 가장 가까운 장소의 상세가 저절로 열린다(홈이 맡는다). 화면에 여러
 * 곳이 담겨 있으면 그 한 곳이 사용자가 노린 곳이 아닐 수 있어서 — "여기가 아니라 옆 장소를 보고
 * 싶다" — 다음으로 가까운 장소로 넘겨 주는 버튼이 필요하다. 이 훅이 그 버튼의 머리다.
 *
 * 훑을 목록은 **당기는 순간에 정해져 저장소에 있다**(`nearbyPlaces`). 이 훅은 그 목록에서 지금
 * 고른 장소의 다음을 찾아 넘기기만 한다 — 끝에서는 처음으로 돌아와 계속 돌 수 있다.
 *
 * 홈과 장소 상세가 함께 쓴다. 두 화면의 버튼이 같은 자리에 같은 모양으로 있어야 하고, 무엇보다
 * **누르는 곳에 따라 화면을 쌓는 방식이 달라야** 한다(`replace` 참고).
 */

export interface NextPlace {
  /**
   * 버튼을 보일지.
   *
   * **두 곳 이상일 때만 보인다.** 한 곳뿐이면 눌러도 그 장소로 되돌아올 뿐이라, 눌리는데 아무
   * 일도 하지 않는 버튼이 된다. 목록은 20m에서만 채워지므로 축척 조건은 이미 이 값에 들어 있다.
   */
  visible: boolean;
  /** 다음으로 가까운 장소로 넘어간다. */
  goNext: () => void;
}

export interface NextPlaceOptions {
  /**
   * 지금 화면을 **갈아 끼울지.**
   *
   * 장소 상세에서 누르면 `true`다 — 그러지 않으면 돌려 볼 때마다 상세가 한 겹씩 쌓인다. 겹이
   * 쌓이면 화면들이 하나뿐인 지도를 두고 다투고, 뒤로 가기가 지나온 장소를 되짚는다.
   *
   * 홈에서 누르면 `false`다. 상세를 처음 여는 것이므로 쌓는 것이 맞고, 뒤로 가면 홈으로 온다.
   */
  replace?: boolean;
}

export function useNextPlace({ replace = false }: NextPlaceOptions = {}): NextPlace {
  const nearbyPlaces = useMapStore((state) => state.nearbyPlaces);
  const selectedPlaceId = useMapStore((state) => state.selectedPlaceId);
  const selectPlace = useMapStore((state) => state.selectPlace);
  const focusOn = useMapStore((state) => state.focusOn);

  const goNext = useCallback(() => {
    if (nearbyPlaces.length === 0) return;

    /*
      지금 고른 장소의 **다음**을 고른다. 목록에 없으면(`-1`) 처음으로 간다 — 지도를 눌러 선택을
      비운 뒤 눌렀을 때가 그렇다. `(-1 + 1) % n`이 0이라 따로 가르지 않아도 맞는다.
    */
    const at = nearbyPlaces.findIndex((place) => place.id === selectedPlaceId);
    const next = nearbyPlaces[(at + 1) % nearbyPlaces.length];

    /*
      **고른 것으로 표시해 둔다.** 다음에 이 버튼을 누를 때 "지금 어디"의 기준이 되고, 홈으로
      돌아갔을 때 그 카드가 골라져 있다.
    */
    selectPlace(next.id);

    /*
      지도를 그 장소로 옮긴다. 축척은 지금 그대로(20m)다 — 그 축척이라 이 버튼이 있는 것이므로
      다시 당길 것이 없고, 이동은 홈이 실행한다(상세 화면은 자기 지도가 없다).
    */
    focusOn({
      coordinate: { latitude: next.latitude, longitude: next.longitude },
      name: next.name,
      level: REVIEW_PIN_MAX_LEVEL,
    });

    const path = `/place/${next.id}` as const;
    if (replace) router.replace(path);
    else router.push(path);
  }, [focusOn, nearbyPlaces, replace, selectPlace, selectedPlaceId]);

  return { visible: nearbyPlaces.length > 1, goNext };
}
