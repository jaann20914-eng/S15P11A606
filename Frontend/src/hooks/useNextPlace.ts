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
 * 홈과 장소 상세가 같은 것을 쓴다. 넘기는 방식도 하나다 — `navigate`가 상세를 보고 있을 때는
 * 그 화면의 장소만 갈아 주고, 홈에서는 새로 띄운다(`goNext`에 그 사정을 적었다).
 */

export interface NextPlace {
  /**
   * 버튼을 보일지. **20m에 닿으면 보인다.**
   *
   * 그 축척에서 생기고 30m 이상으로 넓히면 사라진다 — 축척이 조건의 전부다. 돌려 볼 곳이 한
   * 곳뿐이어도 보인다: 그 축척에 이 버튼이 있다는 것을 알 수 있어야 한다. 대신 누를 수 없게
   * 둔다(`enabled`).
   */
  visible: boolean;
  /**
   * 누를 수 있는지. **돌려 볼 곳이 두 곳 이상일 때만** 참이다.
   *
   * 한 곳뿐이면 눌러도 그 장소로 되돌아올 뿐이라 아무 일도 하지 않는 버튼이 된다. 감추는 대신
   * 흐리게 두어 "지금은 돌려 볼 다른 장소가 없다"가 보이게 한다.
   */
  enabled: boolean;
  /** 다음으로 가까운 장소로 넘어간다. 돌려 볼 곳이 없으면 아무것도 하지 않는다. */
  goNext: () => void;
}

export function useNextPlace(): NextPlace {
  const mapLevel = useMapStore((state) => state.mapLevel);
  const nearbyPlaces = useMapStore((state) => state.nearbyPlaces);
  const selectedPlaceId = useMapStore((state) => state.selectedPlaceId);
  const selectPlace = useMapStore((state) => state.selectPlace);
  const focusOn = useMapStore((state) => state.focusOn);

  const goNext = useCallback(() => {
    if (nearbyPlaces.length < 2) return;

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

    /*
      **`navigate`다 — `push`도 `replace`도 아니다.**

      이미 장소 상세를 보고 있으면 그 화면이 스택에 있으므로, navigate는 새 화면을 만들지 않고
      **그 화면의 장소만 갈아 준다.** 화면이 그대로 있으니 시트가 제자리에 있고 지도만 옆으로
      미끄러진다 — 돌려 보는 손맛이 그것이다.

      `replace`로 갈아 끼웠더니 앞 화면이 떨어져 나가면서 핀 겹이 한순간 비었고, 홈이 그것을
      "상세가 닫혔다"로 읽어 축척을 250m로 넓혔다. 그러면 20m를 벗어났으니 새로 연 상세까지
      접히고, 다시 20m로 돌아와 첫 장소가 열렸다 — 버튼 한 번에 홈을 거쳐 한 바퀴 도는 것으로
      보인 것이 이것이다(2026-08-05 실기기).

      홈에서 누르면 그 화면이 스택에 없으므로 navigate가 새로 띄운다. 두 경우를 한 줄로 다룬다.
    */
    router.navigate(`/place/${next.id}`);
  }, [focusOn, nearbyPlaces, selectPlace, selectedPlaceId]);

  return {
    visible: mapLevel <= REVIEW_PIN_MAX_LEVEL,
    enabled: nearbyPlaces.length > 1,
    goNext,
  };
}
