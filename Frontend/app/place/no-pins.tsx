import { useCallback, useEffect, useMemo, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { AppTabBar, useAppTabBarHeight } from '@/components/common';
import { PlaceSearchBar } from '@/components/place';
import { NoPinPlaceCard } from '@/features/place-search/components';
import { useSearchedPlaceFocus } from '@/features/place-search/hooks/useSearchedPlaceFocus';
import { useBottomSheet } from '@/hooks/useBottomSheet';
import { useCurrentLocation } from '@/hooks/useCurrentLocation';
import { useMapGestures } from '@/hooks/useMapGestures';
import { useScreenLayout } from '@/hooks/useResponsivePadding';
import { useMapStore } from '@/store/useMapStore';
import { MAX_PLACE_DISTANCE_METERS } from '@/types/pinCreate';
import { distanceBetween } from '@/utils/location';
import { colors, layout, radius, spacing, type } from '@/constants/theme';

/**
 * 핀이 아직 없는 장소.
 *
 * 검색에서 장소를 골랐는데 우리 DB에 없을 때 온다(`placeId`가 `null` — `usePlaceConfirm`).
 * 오류가 아니라 **아직 아무도 핀을 남기지 않은 장소**라는 뜻이라, 검색 화면에 안내 한 줄을
 * 띄우고 멈추는 대신 그 장소를 제대로 보여준다. 구성은 홈·장소 상세와 같은 순서다 — 위에 찾은
 * 이름이 남은 검색바, 가운데 그 자리를 비춘 지도, 아래에 3단계 시트.
 *
 * **자기 지도를 만들지 않는다.** 장소 상세와 같은 방식으로 홈 위에 반투명하게 겹쳐, 아래 홈
 * 지도를 그대로 비춘다(`app/_layout.tsx`의 `transparentModal`). 그 지도를 찾은 자리로 20m까지
 * 당겨 놓는 일은 `useSearchedPlaceFocus`가 맡는다.
 *
 * **마커는 하나도 없어야 한다.** 홈 지도에는 주변 장소 마커가 찍혀 있으므로, 빈 핀 겹을
 * 올려 그것을 가린다 — 홈은 겹이 있으면 장소 마커 대신 겹의 마커만 그리고, 그 목록이 비어
 * 있으면 아무것도 그리지 않는다(`pinOverlay`). 이 장소에는 보여줄 핀이 없으니 그것이 맞다.
 */

/**
 * 측정이 오기 전에 쓰는 어림값.
 *
 * 첫 프레임에만 쓰이고 `onLayout` 직후 실제 값으로 바뀐다. 0으로 두면 시트가 화면 전체를
 * 덮은 채 시작해 눈에 띄게 튄다(홈·장소 상세와 같은 이유다).
 */
const ESTIMATED_HEADER_HEIGHT = 88;
const ESTIMATED_CARD_HEIGHT = 200;

export default function PlaceWithoutPins() {
  const { name, address, kakaoPlaceId, latitude, longitude } = useLocalSearchParams<{
    name?: string;
    address?: string;
    kakaoPlaceId?: string;
    latitude?: string;
    longitude?: string;
  }>();
  const { height } = useWindowDimensions();
  const { padding: gutter, insets } = useScreenLayout();
  const navBarHeight = useAppTabBarHeight();

  /*
    시트 머리글의 `현재 위치` 줄에 쓴다.

    권한을 묻지 않고 이미 받아 둔 것만 조용히 읽는다(`auto`) — 홈 시트가 같은 줄을 그리는
    방식이다. 못 읽으면 그 줄을 그리지 않는다.
  */
  const myLocation = useCurrentLocation({ auto: true });

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

  /* 찾은 자리의 좌표. 파라미터에 없으면(최근 검색) 훅이 이름으로 다시 찾아 준다. */
  const placeCoordinate = useSearchedPlaceFocus({ name, coordinate, kakaoPlaceId });

  /**
   * 이 자리에서 핀을 쓸 수 있는지 — **그 장소가 내 위치에서 50m 안일 때만.**
   *
   * 핀 등록은 지금 서 있는 자리의 장소만 고를 수 있다(`GET /places/nearby`가 50m 반경만
   * 주고, 그 반경이 곧 등록 가능 범위다). 그런데 검색은 20km까지 찾으므로, 멀리 있는 장소의
   * 이 화면에서 작성 버튼을 내밀면 눌러 봐야 등록 화면의 장소 목록에 그 장소가 없다 —
   * 갈 수 없는 곳으로 안내하는 셈이라 그때는 버튼 없이 안내만 남긴다.
   *
   * 내 위치나 장소 좌표를 모르면 쓸 수 없는 쪽으로 본다. 등록 화면도 내 위치 없이는 장소를
   * 고를 수 없으므로 판정이 같다.
   */
  const writable =
    placeCoordinate !== null &&
    myLocation.coordinate !== null &&
    distanceBetween(myLocation.coordinate, placeCoordinate) <= MAX_PLACE_DISTANCE_METERS;

  /*
    손가락으로 아래 홈 지도를 끌고 당긴다.

    **터치가 아래까지 닿지 않는다** — 안드로이드에서 위에 겹친 화면이 그대로 삼킨다
    (`useMapGestures`에 근거를 적어 두었다). 그래서 받아서 명령으로 넘긴다. 마커가 없어 탭으로
    고를 것은 없지만, 찾은 자리 주변을 둘러보는 것은 이 화면에서도 자연스럽다.
  */
  const mapGestures = useMapGestures(useMapStore((state) => state.gestureControl));

  const showPinOverlay = useMapStore((state) => state.showPinOverlay);
  const clearPinOverlay = useMapStore((state) => state.clearPinOverlay);

  /**
   * 이 화면이 맨 위인지.
   *
   * **위에 다른 화면이 겹치면 검색바와 시트를 감춘다.** 이 화면도, 위에 오는 장소 상세도 홈
   * 지도를 비추는 반투명 화면이라 감추지 않으면 **두 화면이 그대로 겹쳐 보인다** — 검색을
   * 이어서 두 번 하면 처음 찾은 장소의 시트와 카드가 새 화면 뒤에 붙어 있었다(2026-08-05
   * 실기기). 홈이 이 화면에게, 이 화면이 그 위 화면에게 하는 처리가 같아야 한다.
   *
   * **감추기만 하고 언마운트하지 않는다** — 시트 단계와 재측정을 잃으면 돌아왔을 때 있던
   * 자리로 정확히 돌아오지 못한다.
   */
  const [onTop, setOnTop] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setOnTop(true);
      return () => setOnTop(false);
    }, []),
  );

  /*
    빈 겹을 올려 홈 지도의 장소 마커를 가린다. 화면을 떠날 때 되돌린다 — 비우지 않으면 홈으로
    돌아가도 마커가 하나도 없는 지도가 남는다.

    **맨 위일 때만 올린다.** 위에 장소 상세가 겹치면 그 화면이 자기 핀 겹을 올리는데,
    여기서 덮어쓰면 그쪽 마커가 사라진다. 돌아오면 `onTop`이 참으로 바뀌며 이 효과가 다시 돌아
    빈 겹을 되돌려 놓는다 — 그러지 않으면 상세에서 돌아온 뒤 이 화면에 장소 마커가 남는다.

    **우리가 올린 빈 겹만 걷는다.** 이 화면은 장소 상세 위에 겹쳐 열릴 수 있고, 뒤로 나가는
    애니메이션이 끝난 뒤에야 떼어진다. 그 사이 아래 화면은 이미 focus를 되찾아 자기 핀
    마커를 올려 두었을 수 있는데, 무조건 비우면 방금 되돌아온 그 마커를 지워 버린다.
  */
  useEffect(() => {
    if (!onTop) return;

    showPinOverlay({ markers: [], selectedPinId: null });

    return () => {
      const overlay = useMapStore.getState().pinOverlay;
      if (overlay !== null && overlay.markers.length === 0) clearPinOverlay();
    };
  }, [clearPinOverlay, onTop, showPinOverlay]);

  /*
    시트는 홈·장소 상세와 **같은 3단계 시트다**(`useBottomSheet`).

    고정 높이 상자로 두었더니 답답하다는 의견이 있었다(2026-08-05). 같은 자리에 같은 모양으로
    있는데 하나는 끌리고 하나는 꼼짝하지 않으면, 손이 먼저 끌어보고 나서 "이 화면은 안 되는
    화면"으로 읽는다. 세 화면이 같은 손맛을 갖는 편이 맞다.

    높이를 정하는 값도 홈과 같은 식이다 — 축소는 머리글, 기본은 거기에 카드 한 장, 확장은
    검색바 아래까지. **기준 영역은 홈이 재서 올린 값을 쓴다**(`homeSheetSpace`). 이 화면도 탭
    그룹 밖이라 스스로 잴 수 있는 것이 창 높이뿐인데, 그 값은 홈이 잰 것과 실기기에서 같지
    않다(그 사정은 `useMapStore.homeSheetSpace`에 적혀 있다).

    **끌어내려 닫지는 않는다**(`onDismiss`를 주지 않는다). 축소가 하한이고, 뒤로 가기는 검색바
    왼쪽 꺽새가 맡는다 — 장소 상세와 같은 규칙이다.

    혼잡도 토글(여유·와글)만 홈과 다르게 두지 않는다. 그 토글은 목록을 걸러내는 손잡이인데
    여기에는 걸러낼 목록이 없다 — 카드 한 장뿐이고 그 장소에는 핀이 없다.
  */
  const homeSheetSpace = useMapStore((state) => state.homeSheetSpace);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [cardHeight, setCardHeight] = useState(0);

  const sheet = useBottomSheet({
    space: homeSheetSpace > 0 ? homeSheetSpace : Math.max(0, height - navBarHeight),
    collapsed: headerHeight > 0 ? headerHeight : ESTIMATED_HEADER_HEIGHT,
    // 기본 단계에서 축소보다 더 보여야 하는 높이 = 카드 한 장 + 아래 여백(홈과 같은 값).
    middleExtra: (cardHeight > 0 ? cardHeight : ESTIMATED_CARD_HEIGHT) + spacing.x4,
    expandedTop: insets.top + spacing.x3 + layout.searchHeight + spacing.x4,
  });

  return (
    // 배경을 두지 않는다. 아래 깔린 홈 지도가 그대로 보여야 한다.
    <View pointerEvents="box-none" style={s.overlay}>
      {/*
        지도 제스처를 받는 자리. **가장 먼저 그려 맨 아래에 깐다** — 검색바·시트·탭바는 뒤에
        그려지므로 그 영역의 터치는 그쪽이 먼저 받는다(장소 상세와 같은 구조다).
      */}
      <View {...mapGestures.panHandlers} style={s.mapGestureArea} />

      {/* 위에 다른 화면이 겹쳐 있으면 감춘다. `display`로 빼야 배치와 그리기까지 건너뛴다. */}
      <View
        style={[s.top, !onTop && s.covered, { top: insets.top + spacing.x3, left: gutter, right: gutter }]}
      >
        <PlaceSearchBar keyword={name ?? null} />
      </View>

      <Animated.View style={[s.sheet, !onTop && s.covered, { transform: [{ translateY: sheet.sheetY }] }]}>
        {/* 농도를 정하는 유일한 겹. 값은 홈·장소 상세 시트와 같다(`colors.sheetSurface`). */}
        <View style={s.sheetSurface} />

        <View {...sheet.panHandlers}>
          {/*
            손잡이와 머리글. 홈 시트와 같은 구성이다 — 손잡이, `주위를 둘러볼까요?`,
            `현재 위치 : …`. 탭하면 다음 단계로 돌고, 끌면 따라온다.

            높이는 고정하지 않고 재서 스냅 계산에 넘긴다(`onLayout`). 글꼴 크기 설정이나 화면
            폭이 달라도 카드가 어중간하게 걸리지 않는다.
          */}
          <Pressable
            accessibilityRole="adjustable"
            accessibilityLabel="장소 정보 높이"
            accessibilityHint="탭하거나 위아래로 끌어 높이를 변경하세요"
            onPress={sheet.cycle}
            onLayout={(event) => setHeaderHeight(Math.round(event.nativeEvent.layout.height))}
            style={[s.handleArea, { paddingHorizontal: gutter }]}
          >
            <View style={s.handle} />
            {/*
              제목 줄. 홈은 이 줄에 혼잡도 토글을 함께 두어 44px을 확보하는데, 토글이 없는
              여기서도 같은 높이를 잡아 **두 시트의 첫 줄이 같은 자리에 앉는다.**
            */}
            <View style={s.headingRow}>
              <Text numberOfLines={1} style={s.sheetTitle}>
                주위를 둘러볼까요?
              </Text>
            </View>
            {/* 지역 이름을 얻지 못하면 줄을 비운다. 틀린 지역을 적는 것보다 낫다(홈과 같다). */}
            {myLocation.areaName !== null && (
              <Text numberOfLines={1} style={s.sheetSubtitle}>
                현재 위치 : {myLocation.areaName}
              </Text>
            )}
          </Pressable>
        </View>

        {/* 이름이 없으면 카드를 그리지 않는다. 빈 카드는 고장으로 읽힌다. */}
        {name !== undefined && (
          <View
            onLayout={(event) => setCardHeight(Math.round(event.nativeEvent.layout.height))}
            style={{ paddingHorizontal: gutter }}
          >
            <NoPinPlaceCard name={name} address={address ?? ''} writable={writable} />
          </View>
        )}
      </Animated.View>

      {/*
        홈을 강조한다. 검색은 홈의 탐색 맥락에 속하므로 사용자는 여전히 "홈"에 있다
        (장소 상세와 같다).
      */}
      <AppTabBar active="home" />
    </View>
  );
}

/*
  시트 겉모습은 홈·장소 상세와 **같은 값을 세 번째로 적는 것이다.**

  값이 갈리면 세 화면의 시트가 서로 달라 보이므로 그때는 겉겹(표면·손잡이)을 공용 컴포넌트로
  뽑아야 한다. 지금은 두 화면이 이미 각자 갖고 있어 셋을 한 번에 옮기는 편이 안전하고, 그것은
  이 화면의 일이 아니라 따로 할 일로 남긴다.
*/
const shadow = {
  shadowColor: colors.dark,
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.15,
  shadowRadius: 16,
  elevation: 7,
};

const s = StyleSheet.create({
  /** 장소 상세와 같은 뼈대다. 배경을 두지 않아 아래 홈 지도가 그대로 비친다. */
  overlay: { flex: 1, overflow: 'hidden' },
  /** 지도 제스처를 받는 자리. 아무것도 그리지 않고 손가락만 받는다. */
  mapGestureArea: StyleSheet.absoluteFillObject,
  top: { position: 'absolute' },
  /** 위에 다른 화면이 겹쳤을 때. 두 화면의 검색바·시트가 같은 자리에 겹쳐 보이지 않게 한다. */
  covered: { display: 'none' },
  /**
   * 반투명 시트. 흰 농도는 `sheetSurface` 한 겹으로만 정한다 — 위아래로 더 얹으면 겹친 곳만
   * 농도가 올라가 시트가 투톤으로 갈려 보인다.
   */
  sheet: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    borderTopLeftRadius: radius.hero,
    borderTopRightRadius: radius.hero,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255,255,255,0.82)',
    ...shadow,
  },
  /**
   * 위쪽 모서리를 **스스로도** 둥글게 둔다. 감싼 시트가 `overflow: 'hidden'`으로 잘라 주기는
   * 하지만, 안드로이드에서 그 자르기가 둥근 모서리까지 따라오지 않으면 이 겹이 네모난 모서리로
   * 덮어 버린다.
   */
  sheetSurface: {
    ...StyleSheet.absoluteFillObject,
    borderTopLeftRadius: radius.hero,
    borderTopRightRadius: radius.hero,
    backgroundColor: colors.sheetSurface,
  },
  /** 손잡이와 머리글. 여백은 홈 시트의 머리글과 같은 값이라 두 시트의 첫 줄이 같은 높이에 놓인다. */
  handleArea: { paddingTop: spacing.x2, paddingBottom: spacing.x3 },
  handle: {
    width: 40,
    height: 4,
    alignSelf: 'center',
    borderRadius: radius.pill,
    backgroundColor: 'rgba(59,56,56,0.32)',
    marginBottom: spacing.x1,
  },
  /**
   * 시트 제목. 홈 시트의 같은 줄과 같은 값이다.
   *
   * 홈은 이 줄을 혼잡도 토글과 한 줄에 두어 44px을 확보하고 아래 줄을 음수 여백으로 당겨
   * 붙인다. 여기는 토글이 없어 그 보정도 필요하지 않다 — 두 줄이 그대로 붙는다.
   */
  headingRow: { minHeight: 44, justifyContent: 'center' },
  sheetTitle: { ...type.body, fontSize: 17, lineHeight: 26, fontWeight: '600', color: colors.dark },
  /**
   * 현재 위치 줄. 제목 바로 아래에 붙인다.
   *
   * 위로 당기는 이유는 홈과 같다 — 제목 줄이 44px을 확보하는데 글줄은 26px뿐이라 아래에 빈 칸이
   * 남는다. 그만큼을 되돌려 두 줄을 붙인다.
   */
  sheetSubtitle: { ...type.caption, color: colors.gray600, marginTop: -spacing.x1 },
});
