import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AppTabBar, useAppTabBarHeight } from '@/components/common';
import { PlaceSearchBar } from '@/components/place';
import { NoPinPlaceCard } from '@/features/place-search/components';
import { useMapGestures } from '@/hooks/useMapGestures';
import { useScreenLayout } from '@/hooks/useResponsivePadding';
import { useMapStore } from '@/store/useMapStore';
import { spacing } from '@/constants/theme';

/**
 * 영상핀이 아직 없는 장소.
 *
 * 검색에서 장소를 골랐는데 우리 DB에 없을 때 온다(`placeId`가 `null` — `usePlaceConfirm`).
 * 오류가 아니라 **아직 아무도 핀을 남기지 않은 장소**라는 뜻이라, 검색 화면에 안내 한 줄을
 * 띄우고 멈추는 대신 그 장소를 제대로 보여준다. 구성은 장소 상세와 같은 순서다 — 위에 찾은
 * 이름이 남은 검색바, 가운데 그 자리를 비춘 지도, 그 아래 첫 핀을 부르는 카드.
 *
 * **자기 지도를 만들지 않는다.** 장소 상세와 같은 방식으로 홈 위에 반투명하게 겹쳐, 아래 홈
 * 지도를 그대로 비춘다(`app/_layout.tsx`의 `transparentModal`). 지도를 그 자리로 옮기는 일은
 * 이 화면을 띄우기 전에 검색 쪽이 이미 해 둔다(`usePlaceConfirm`의 `focusOn`).
 *
 * **마커는 하나도 없어야 한다.** 홈 지도에는 주변 장소 마커가 찍혀 있으므로, 빈 영상핀 겹을
 * 올려 그것을 가린다 — 홈은 겹이 있으면 장소 마커 대신 겹의 마커만 그리고, 그 목록이 비어
 * 있으면 아무것도 그리지 않는다(`pinOverlay`). 이 장소에는 보여줄 핀이 없으니 그것이 맞다.
 */

/** 카드를 화면 아래쪽에 둔다. 지도는 위쪽 절반에서 찾은 자리를 보여주는 몫이다. */
const CARD_TOP_RATIO = '52%';

export default function PlaceWithoutPins() {
  const { name, address } = useLocalSearchParams<{ name?: string; address?: string }>();
  const { padding: gutter, insets } = useScreenLayout();
  const navBarHeight = useAppTabBarHeight();

  /*
    손가락으로 아래 홈 지도를 끌고 당긴다.

    **터치가 아래까지 닿지 않는다** — 안드로이드에서 위에 겹친 화면이 그대로 삼킨다
    (`useMapGestures`에 근거를 적어 두었다). 그래서 받아서 명령으로 넘긴다. 마커가 없어 탭으로
    고를 것은 없지만, 찾은 자리 주변을 둘러보는 것은 이 화면에서도 자연스럽다.
  */
  const mapGestures = useMapGestures(useMapStore((state) => state.gestureControl));

  const showPinOverlay = useMapStore((state) => state.showPinOverlay);
  const clearPinOverlay = useMapStore((state) => state.clearPinOverlay);

  /*
    빈 겹을 올려 홈 지도의 장소 마커를 가린다. 화면을 떠날 때 반드시 되돌린다 — 비우지 않으면
    홈으로 돌아가도 마커가 하나도 없는 지도가 남는다.
  */
  useEffect(() => {
    showPinOverlay({ markers: [], selectedPinId: null });
    return clearPinOverlay;
  }, [clearPinOverlay, showPinOverlay]);

  return (
    // 배경을 두지 않는다. 아래 깔린 홈 지도가 그대로 보여야 한다.
    <View pointerEvents="box-none" style={s.overlay}>
      {/*
        지도 제스처를 받는 자리. **가장 먼저 그려 맨 아래에 깐다** — 검색바·카드·탭바는 뒤에
        그려지므로 그 영역의 터치는 그쪽이 먼저 받는다(장소 상세와 같은 구조다).
      */}
      <View {...mapGestures.panHandlers} style={s.mapGestureArea} />

      <View style={[s.top, { top: insets.top + spacing.x3, left: gutter, right: gutter }]}>
        <PlaceSearchBar keyword={name ?? null} />
      </View>

      {/*
        카드는 화면 아래쪽에 둔다. 위쪽은 찾은 자리를 보여주는 지도 몫이다.

        위에서 눌러 놓고(`top`) 아래로도 붙여(`bottom`) 탭바 위에서 끝나게 한다. 카드 높이는
        주소 줄 유무로 달라지는데, 두 변을 다 잡아 두면 그 차이가 카드 안에서 흡수되어 지도가
        보이는 높이는 늘 같다.
      */}
      <View
        pointerEvents="box-none"
        style={[
          s.cardArea,
          { top: CARD_TOP_RATIO, left: gutter, right: gutter, bottom: navBarHeight + spacing.x4 },
        ]}
      >
        {/* 이름이 없으면 카드를 그리지 않는다. 빈 카드는 고장으로 읽힌다. */}
        {name !== undefined && <NoPinPlaceCard name={name} address={address ?? ''} />}
      </View>

      {/*
        홈을 강조한다. 검색은 홈의 탐색 맥락에 속하므로 사용자는 여전히 "홈"에 있다
        (장소 상세와 같다).
      */}
      <AppTabBar active="home" />
    </View>
  );
}

const s = StyleSheet.create({
  /** 장소 상세와 같은 뼈대다. 배경을 두지 않아 아래 홈 지도가 그대로 비친다. */
  overlay: { flex: 1 },
  /** 지도 제스처를 받는 자리. 아무것도 그리지 않고 손가락만 받는다. */
  mapGestureArea: StyleSheet.absoluteFillObject,
  top: { position: 'absolute' },
  /**
   * 카드가 놓이는 칸.
   *
   * `box-none`이 없으면 카드 위아래 빈 자리가 지도 드래그를 가로챈다 — 칸은 카드보다 크고,
   * 남는 자리는 지도가 보이는 자리다.
   */
  cardArea: { position: 'absolute', justifyContent: 'flex-start' },
});
