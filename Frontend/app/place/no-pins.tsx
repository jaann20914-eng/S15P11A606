import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AppTabBar, useAppTabBarHeight } from '@/components/common';
import { PlaceSearchBar } from '@/components/place';
import { NoPinPlaceCard } from '@/features/place-search/components';
import { useSearchedPlaceFocus } from '@/features/place-search/hooks/useSearchedPlaceFocus';
import { useMapGestures } from '@/hooks/useMapGestures';
import { useScreenLayout } from '@/hooks/useResponsivePadding';
import { useMapStore } from '@/store/useMapStore';
import { colors, radius, spacing } from '@/constants/theme';

/**
 * 영상핀이 아직 없는 장소.
 *
 * 검색에서 장소를 골랐는데 우리 DB에 없을 때 온다(`placeId`가 `null` — `usePlaceConfirm`).
 * 오류가 아니라 **아직 아무도 핀을 남기지 않은 장소**라는 뜻이라, 검색 화면에 안내 한 줄을
 * 띄우고 멈추는 대신 그 장소를 제대로 보여준다. 구성은 장소 상세와 같은 순서다 — 위에 찾은
 * 이름이 남은 검색바, 가운데 그 자리를 비춘 지도, 아래에 첫 핀을 부르는 카드.
 *
 * **자기 지도를 만들지 않는다.** 장소 상세와 같은 방식으로 홈 위에 반투명하게 겹쳐, 아래 홈
 * 지도를 그대로 비춘다(`app/_layout.tsx`의 `transparentModal`). 그 지도를 찾은 자리로 20m까지
 * 당겨 놓는 일은 `useSearchedPlaceFocus`가 맡는다.
 *
 * **마커는 하나도 없어야 한다.** 홈 지도에는 주변 장소 마커가 찍혀 있으므로, 빈 영상핀 겹을
 * 올려 그것을 가린다 — 홈은 겹이 있으면 장소 마커 대신 겹의 마커만 그리고, 그 목록이 비어
 * 있으면 아무것도 그리지 않는다(`pinOverlay`). 이 장소에는 보여줄 핀이 없으니 그것이 맞다.
 */

export default function PlaceWithoutPins() {
  const { name, address, kakaoPlaceId, latitude, longitude } = useLocalSearchParams<{
    name?: string;
    address?: string;
    kakaoPlaceId?: string;
    latitude?: string;
    longitude?: string;
  }>();
  const { padding: gutter, insets } = useScreenLayout();
  const navBarHeight = useAppTabBarHeight();

  /*
    검색 결과에서 들고 온 좌표. 경로 파라미터는 문자열이라 숫자로 바꾼다.

    **매 렌더마다 새 객체를 만들면 안 된다** — 지도를 옮기는 효과가 이 값을 조건으로 보므로,
    새 객체가 될 때마다 같은 자리로 옮기는 명령이 되풀이된다.
  */
  const coordinate = useMemo(() => {
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;

    return { latitude: lat, longitude: lng };
  }, [latitude, longitude]);

  useSearchedPlaceFocus({ name, coordinate, kakaoPlaceId });

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
    빈 겹을 올려 홈 지도의 장소 마커를 가린다. 화면을 떠날 때 되돌린다 — 비우지 않으면 홈으로
    돌아가도 마커가 하나도 없는 지도가 남는다.

    **우리가 올린 빈 겹만 걷는다.** 이 화면은 장소 상세 위에 겹쳐 열릴 수 있고, 뒤로 나가는
    애니메이션이 끝난 뒤에야 떼어진다. 그 사이 아래 화면은 이미 focus를 되찾아 자기 영상핀
    마커를 올려 두었을 수 있는데, 무조건 비우면 방금 되돌아온 그 마커를 지워 버린다.
  */
  useEffect(() => {
    showPinOverlay({ markers: [], selectedPinId: null });

    return () => {
      const overlay = useMapStore.getState().pinOverlay;
      if (overlay !== null && overlay.markers.length === 0) clearPinOverlay();
    };
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
        카드를 감싸는 시트.

        장소 상세의 시트와 **같은 모양으로 화면 아래에 앉힌다** — 둥근 윗모서리, 같은 농도의
        반투명 표면, 같은 그림자다. 검색에서 이어지는 두 화면(핀이 있는 장소 · 없는 장소)이
        같은 자리에 같은 덩어리를 두어야 "같은 종류의 화면"으로 읽힌다.

        **손잡이는 두지 않는다.** 이 시트는 단계가 없어 끌어올릴 것이 없고, 손잡이가 있으면
        끌어보게 만든 뒤 아무 일도 일어나지 않는다.

        높이는 내용이 정한다. 카드 한 장뿐이라 아래쪽에 낮게 앉고, 위쪽은 찾은 자리를 보여주는
        지도 몫으로 남는다.
      */}
      <View
        style={[
          s.sheet,
          { paddingHorizontal: gutter, paddingTop: spacing.x5, paddingBottom: navBarHeight + spacing.x5 },
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
   * 카드를 감싸는 시트. 값은 장소 상세 시트와 같다(`colors.sheetSurface` · `radius.hero`).
   *
   * 아래쪽 모서리는 둥글게 하지 않는다 — 화면 아래끝까지 내려가 탭바에 닿으므로, 둥글리면
   * 그 사이로 지도가 비쳐 시트가 떠 있는 것처럼 보인다.
   */
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radius.hero,
    borderTopRightRadius: radius.hero,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255,255,255,0.82)',
    backgroundColor: colors.sheetSurface,
    shadowColor: colors.dark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 7,
  },
});
