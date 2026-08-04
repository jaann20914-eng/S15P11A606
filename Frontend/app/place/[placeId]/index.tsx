import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppTabBar, useAppTabBarHeight } from '@/components/common';
import { CrowdChart } from '@/components/place';
import { PinCardPager } from '@/features/place-detail/components/PinCardPager';
import { usePlaceDetail } from '@/features/place-detail/hooks/usePlaceDetail';
import { useScreenLayout } from '@/hooks/useResponsivePadding';
import { useCurrentLocation } from '@/hooks/useCurrentLocation';
import { useBottomSheet } from '@/hooks/useBottomSheet';
import { useFadeToggle } from '@/hooks/useFadeToggle';
import { useMapGestures } from '@/hooks/useMapGestures';
import { createDevLogger } from '@/utils/devLog';
import { useMapStore } from '@/store/useMapStore';
import { REVIEW_PIN_MAX_LEVEL } from '@/components/home/kakaoMapHtml';
import { colors, layout, radius, spacing, type } from '@/constants/theme';

/**
 * 측정이 오기 전에 쓰는 어림값.
 *
 * 첫 프레임에만 쓰이고 `onLayout` 직후 실제 값으로 바뀐다. 0으로 두면 시트가 화면 전체를
 * 덮은 채 시작해 눈에 띄게 튄다.
 */
const ESTIMATED_HEADER_HEIGHT = 92;
const ESTIMATED_PIN_SLOT_HEIGHT = 240;

/** "실시간 영상핀" 왼쪽의 작은 점. 지금 올라오는 중임을 알리는 표시다. */
const LIVE_DOT_SIZE = 7;

/**
 * 장소 카드의 안쪽 여백.
 *
 * `CrowdChart`가 자기 배경을 그리지 않을 때 **감싸는 카드의 여백이 이 값이어야 한다** —
 * 선을 그릴 폭을 그 전제로 계산한다(`CrowdChart`의 `CARD_PADDING`·`PLOT_INSET`).
 */
const CHART_CARD_PADDING = spacing.x5;

/** 혼잡도 그래프가 펼쳐지는 데 걸리는 시간(ms). 접히는 쪽은 조금 빠르게 끝낸다. */
const CHART_REVEAL_MS = 320;
const CHART_HIDE_MS = 180;

/** 펼쳐질 때 그래프가 위에서 내려앉는 거리(px). 카드가 자라는 느낌을 만든다. */
const CHART_RISE = 12;

/**
 * 애니메이션을 얹을 수 있는 누를 것.
 *
 * `Animated.View`로 감싸는 대신 버튼 자체를 움직인다. 감싸면 `alignSelf`·`marginTop` 같은
 * 배치 속성을 감싼 쪽으로 옮겨야 해서 스타일이 두 곳으로 갈린다.
 */
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** 카드와 지도가 함께 움직이는지 터미널에서 따라갈 수 있게 한다. */
const log = createDevLogger('place-detail');

export default function Place() {
  const { placeId } = useLocalSearchParams<{ placeId: string }>();
  const { height } = useWindowDimensions();
  const { padding: gutter, insets } = useScreenLayout();
  const focusOn = useMapStore((state) => state.focusOn);
  const showPinOverlay = useMapStore((state) => state.showPinOverlay);
  const clearPinOverlay = useMapStore((state) => state.clearPinOverlay);
  /*
    이 화면에서 지도를 끌고 당기는 길.

    **손가락이 아래 홈 지도까지 닿지 않는다.** 안드로이드에서 위에 겹친 화면이 터치를 그대로
    삼키기 때문이다(`useMapGestures`에 근거를 적어 두었다). 그래서 이 화면이 제스처를 받아
    홈이 등록해 둔 손잡이로 넘긴다.
  */
  const mapGestures = useMapGestures(useMapStore((state) => state.gestureControl));
  const myLocation = useCurrentLocation();
  const navBarHeight = useAppTabBarHeight();

  /*
    장소 기본정보 · 활성 핀 카드 · 요일별 혼잡 통계를 한 번에 받는다.

    경로 파라미터는 문자열이라 숫자로 바꿔 넘긴다. 숫자로 읽히지 않으면 조회하지 않고 바로
    안내를 띄운다 — NaN을 그대로 보내면 서버가 400으로 답할 뿐 원인이 드러나지 않는다.
  */
  const numericPlaceId = Number(placeId);
  const { detail, loading, error } = usePlaceDetail(Number.isInteger(numericPlaceId) ? numericPlaceId : null);
  const place = detail?.place ?? null;
  const pins = detail?.pins ?? [];

  /*
    3단계 높이를 정하는 값. 시트 움직임은 useBottomSheet이 맡는다.

    - 축소 — 손잡이 + 머리글(장소명·주소 + `실시간 영상핀`)
    - 기본 — 거기에 영상핀 첫 카드까지
    - 확장 — 검색바 바로 아래까지 올려 혼잡도 차트와 목록을 훑는다

    **구성이 홈 시트와 같아서 "기본" 단계 높이도 홈과 같아진다.** 홈은 `머리글 + 카드 한 장`,
    이 화면은 `머리글 + 영상핀 카드 한 장`이다. 요일별 혼잡도를 확장 전용으로 옮긴 것이 그
    조건이었다 — 예전에는 그 카드가 축소 높이에 들어 있어 시트가 홈보다 두 배 가까이 높았다.

    **기준 영역은 홈이 재서 올린 값을 그대로 쓴다**(`homeSheetSpace`). 이 화면은 탭 그룹 밖이라
    스스로 잴 수 있는 것이 창 높이뿐이고, 거기서 탭바를 빼도 홈이 잰 값과 같지 않았다 — 같은
    식으로 계산했는데도 상세 시트가 홈보다 눈에 띄게 높았던 이유다. 재는 쪽 값을 나눠 쓰면
    어긋날 여지가 없고, 두 화면이 탭바·시스템 내비게이션 높이를 각자 더하고 빼지 않아도 된다.

    홈을 거치지 않고 이 주소로 바로 들어오면 아직 잰 값이 없으므로 창 높이에서 탭바를 뺀다.
  */
  const homeSheetSpace = useMapStore((state) => state.homeSheetSpace);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [pinSlotHeight, setPinSlotHeight] = useState(0);

  const sheet = useBottomSheet({
    space: homeSheetSpace > 0 ? homeSheetSpace : Math.max(0, height - navBarHeight),
    collapsed: headerHeight > 0 ? headerHeight : ESTIMATED_HEADER_HEIGHT,
    /*
      "기본" 단계에서 축소보다 더 보여야 하는 높이 = 카드 한 칸 + 아래 여백.

      카드 한 칸의 높이는 페이저가 알려 준다(`onSlotHeightChange`) — 확장 단계에서는 같은
      자리가 목록이 되어 카드 전부의 높이가 나오므로 화면이 직접 잴 수 없다. 머리글과 카드
      사이 간격은 머리글의 `paddingBottom`이 갖는다(홈과 같다).
    */
    middleExtra: (pinSlotHeight > 0 ? pinSlotHeight : ESTIMATED_PIN_SLOT_HEIGHT) + spacing.x4,
    expandedTop: insets.top + spacing.x3 + layout.searchHeight + spacing.x4,
    /*
      아래로 밀어 내리면 닫고 홈 시트로 돌아간다. 이 화면은 홈 위에 겹쳐 있으므로
      "내려서 덮개를 걷는" 동작이 곧 뒤로 가기다. 별도 버튼을 두지 않아도 된다.
    */
    onDismiss: router.back,
  });
  const { level, moveTo, sheetY } = sheet;

  /*
    지도를 여기서 옮기지 않는다.

    예전에는 들어오면서 목업 좌표로 아래 깔린 홈 지도를 옮겼다. 이제 홈이 카드를 누른 그
    시점에 이미 그 장소로 옮기고 축척까지 맞춘 뒤 이 화면을 띄우므로, 여기서 또 옮기면 같은
    자리로 한 번 더 끌려가는 셈이다.

    장소 상세 응답에는 좌표가 없어서(`PlaceSummary`) 옮기려면 목록 API를 한 번 더 불러야
    한다. 홈을 거치지 않고 이 주소로 바로 들어오는 경로가 생기면 그때 붙인다.
  */

  /**
   * 현재 위치로 이동. 이 화면에는 지도가 없으므로 **아래 깔린 홈 지도**에 요청한다.
   *
   * 검색 결과 이동에 쓰던 `useMapStore.focus`를 그대로 재사용한다. 홈이 살아 있어 그 지도가
   * 움직이고, 우리는 반투명하게 겹쳐 있으니 사용자에게는 이 화면의 지도가 움직인 것으로 보인다.
   */
  const goToMyLocation = useCallback(async () => {
    const coordinate = await myLocation.request();
    if (coordinate) focusOn({ coordinate, name: '현재 위치' });
  }, [focusOn, myLocation]);

  /*
    혼잡도 그래프가 드러나는 모션.

    **카드 높이를 함께 늘린다.** 그래프를 제 높이로 곧바로 붙이면 카드가 한 프레임에 200px
    가까이 자라고, 아래 영상핀 구역이 그만큼 통째로 밀려 내려간다 — 시트는 스프링으로 부드럽게
    가는데 안에서만 툭 뛰는 것이 전환이 끊겨 보이던 가장 큰 이유였다.

    예전에 같은 것을 시도했다가 그래프가 아예 보이지 않은 적이 있다. 제 높이를 **높이 0으로
    잘린 상자 안에서** 재고 있어 측정이 0으로 왔고, 늘릴 목표가 0에 머물렀다. 그래서 이번에는
    재는 일을 **흐름 밖(절대 배치)에서** 따로 하고(`chartProbe`) 다 재면 떼어 낸다.

    재지 못해도 그래프가 사라지지 않는다 — 목표 높이가 없으면 높이를 지정하지 않아 제 높이로
    그려진다. 부드럽지 않을 뿐이다.

    접을 때는 사라지는 것을 다 보여준 뒤에 떼어 낸다. 곧바로 떼면 툭 없어진다.
  */
  const chartReveal = useRef(new Animated.Value(0)).current;
  const [chartMounted, setChartMounted] = useState(false);
  const [chartHeight, setChartHeight] = useState(0);
  const expanded = level === 2;

  /** 최대화 단계에서는 시트가 검색바 아래까지 올라와 내 위치 버튼과 겹치므로 감춘다. */
  const locationButton = useFadeToggle(!expanded);

  /*
    영상핀을 지도에 올리고, 보고 있는 게시물에 맞춰 지도를 옮긴다.

    이 화면은 **자기 지도가 없다.** 반투명 모달로 홈 위에 겹쳐 있어 아래 홈 지도가 그대로
    보이므로, 마커도 홈에게 부탁해 그린다(`showPinOverlay`). 내 위치 버튼이 이미 같은 방식이다.

    좌표가 없는 핀은 마커로 찍을 수 없다 — 서버가 아직 촬영 좌표를 주지 않아 실서버에서는
    비어 있고, 목업에서는 채워진다. 비면 마커를 올리지 않고 지도는 장소 자리에 머문다.
  */
  const [pinIndex, setPinIndex] = useState(0);

  /*
    목록(확장) 단계에서 지금 보고 있는 핀을 정하는 값들.

    한 장씩 넘기는 단계는 칸이 정해 주지만(`onIndexChange`), 훑는 단계에서는 스크롤이 멈춘
    자리가 정한다. 그래야 두 단계 모두 **보고 있는 게시물의 마커가 중앙에 물방울 모양으로**
    놓인다 — 예전에는 목록에서 아무리 내려도 첫 핀에 머물러 있었다.
  */
  const [scrollOffset, setScrollOffset] = useState<number | null>(null);
  const [pinListTop, setPinListTop] = useState(0);

  /*
    목록 단계를 벗어나면 알린 스크롤 위치를 버린다.

    남겨 두면 다시 펼치는 순간 **그 낡은 값이 적용돼 첫 핀으로 되돌아간다** — 카드를 넘겨 세
    번째 핀을 보다가 시트를 펼치기만 해도 지도가 처음 핀으로 튀는 셈이다. 비워 두면 펼친 뒤
    실제로 스크롤할 때까지 지금 보고 있는 핀이 유지된다.
  */
  useEffect(() => {
    if (!expanded) setScrollOffset(null);
  }, [expanded]);

  const pinMarkers = useMemo(
    () =>
      pins
        .filter((pin) => pin.latitude !== null && pin.longitude !== null)
        .map((pin) => ({
          id: pin.pinId,
          name: pin.nickname,
          latitude: pin.latitude as number,
          longitude: pin.longitude as number,
        })),
    [pins],
  );

  /** 지금 보고 있는 게시물의 좌표. 없으면 지도를 옮기지 않는다. */
  const focusedPin = pins[pinIndex] ?? null;

  useEffect(() => {
    if (pinMarkers.length === 0) return;

    showPinOverlay({ markers: pinMarkers, selectedPinId: focusedPin?.pinId ?? null });
  }, [focusedPin, pinMarkers, showPinOverlay]);

  /* 상세를 닫으면 홈이 다시 장소 마커를 찍어야 한다. 비우지 않으면 영상핀이 남는다. */
  useEffect(() => clearPinOverlay, [clearPinOverlay]);

  /*
    보고 있는 게시물의 핀을 화면 중앙으로 데려온다.

    20m까지 당긴다 — 한 장소의 핀이 수십 미터 안에 모여 있어 장소용 축척(250m)으로는 여러
    개가 한 점처럼 겹쳐 어느 것이 중앙인지 알 수 없다.
  */
  useEffect(() => {
    if (focusedPin === null) return;

    if (focusedPin.latitude === null || focusedPin.longitude === null) {
      /*
        좌표가 없으면 옮길 곳이 없다. **조용히 넘기지 않는다** — 화면에는 "카드를 넘겨도 지도가
        가만히 있다"로만 보이고 이유가 어디에도 남지 않는다. 실서버에서는 핀 카드 응답에 좌표가
        없어 목록 API에서 붙이는데(`usePlaceDetail`), 그 목록에 없는 핀은 여기서 비어 있다.
      */
      log('카드 전환 — 좌표 없어 지도를 옮기지 못함', {
        번째: `${pinIndex + 1}/${pins.length}`,
        pinId: focusedPin.pinId,
      });
      return;
    }

    /*
      한 장소의 핀들은 몇 미터 안에 모여 있을 수 있다. 그러면 옮겨도 화면이 거의 그대로여서
      동작하지 않는 것으로 보이므로, 어디로 옮겼는지 좌표를 남긴다. 마커 모양(물방울/동그라미)이
      바뀌는 것이 그때는 유일한 단서다.
    */
    log('카드 전환 — 지도 이동', {
      번째: `${pinIndex + 1}/${pins.length}`,
      작성자: focusedPin.nickname,
      좌표: `${focusedPin.latitude.toFixed(6)}, ${focusedPin.longitude.toFixed(6)}`,
    });

    focusOn({
      coordinate: { latitude: focusedPin.latitude, longitude: focusedPin.longitude },
      name: focusedPin.nickname,
      level: REVIEW_PIN_MAX_LEVEL,
    });
  }, [focusOn, focusedPin, pinIndex, pins.length]);

  useEffect(() => {
    if (expanded) setChartMounted(true);

    const animation = Animated.timing(chartReveal, {
      toValue: expanded ? 1 : 0,
      duration: expanded ? CHART_REVEAL_MS : CHART_HIDE_MS,
      easing: expanded ? Easing.out(Easing.cubic) : Easing.in(Easing.quad),
      /*
        높이는 레이아웃 속성이라 네이티브 드라이버로 다룰 수 없다. 투명도·이동도 같은 값에
        묶어 함께 JS로 돌린다 — 나눠 돌리면 두 값이 미세하게 어긋나 더 어색해진다.
      */
      useNativeDriver: false,
    });

    animation.start(({ finished }) => {
      // 끝까지 접힌 뒤에만 떼어 낸다. 중간에 다시 펼치면 애니메이션이 취소돼 여기 오지 않는다.
      if (finished && !expanded) setChartMounted(false);
    });

    return () => animation.stop();
  }, [chartReveal, expanded]);

  return (
    // 배경을 두지 않는다. 아래 깔린 홈 지도가 그대로 보여야 한다.
    // box-none이라 지도 영역의 터치가 아래 홈 지도로 지나간다. 시트와 상단 컨트롤은 자식이라 그대로 받는다.
    <View pointerEvents="box-none" style={s.overlay}>
      {/*
        지도 제스처를 받는 자리. 화면 전체를 덮되 **가장 먼저 그려 맨 아래에 깔린다** —
        시트·상단 컨트롤·탭바는 뒤에 그려지므로 그 영역의 터치는 그쪽이 먼저 받는다. 결과적으로
        지도가 드러난 자리에서만 여기로 온다.

        아래 홈 지도로 터치를 통과시키는 것이 아니라 **받아서 명령으로 넘긴다.** 안드로이드에서
        통과가 되지 않기 때문이다(`useMapGestures` 참고).
      */}
      <View {...mapGestures.panHandlers} style={s.mapGestureArea} />

      {/* box-none이 없으면 검색바와 버튼 사이 빈 공간이 지도 드래그를 가로챈다. */}
      <View
        pointerEvents="box-none"
        style={[s.topControls, { top: insets.top + spacing.x3, left: gutter, right: gutter }]}
      >
        <Pressable onPress={() => router.push('/(tabs)/home/search')} style={s.search}>
          <Ionicons name="search" size={22} color={colors.gray600} />
          <Text style={s.searchText}>장소명이나 태그를 검색해보세요</Text>
        </Pressable>
        {/*
          최대화 단계에서는 시트가 검색바 바로 아래까지 올라와 이 버튼과 겹친다. 그래서 감춘다.

          조건을 그대로 `&&`로 걸면 툭 없어지고 툭 생긴다 — 시트는 스프링으로 부드럽게
          움직이는데 그 위 버튼만 순간이동하면 두 움직임이 따로 노는 것으로 보인다.
          `useFadeToggle`이 사라지는 모션을 다 보여준 뒤에 뗀다.
        */}
        {locationButton.mounted && (
          <AnimatedPressable
            accessibilityRole="button"
            accessibilityLabel="현재 위치로 이동"
            accessibilityState={{ busy: myLocation.status === 'loading' }}
            disabled={myLocation.status === 'loading'}
            onPress={goToMyLocation}
            style={[s.location, locationButton.style]}
          >
            {/* 홈과 같은 이유로 기다리는 중임을 드러낸다. 표시가 없으면 먹통으로 보인다. */}
            {myLocation.status === 'loading' ? (
              <ActivityIndicator size="small" color={colors.dark} />
            ) : (
              <Ionicons
                name={myLocation.status === 'granted' ? 'locate' : 'locate-outline'}
                size={22}
                color={myLocation.status === 'denied' ? colors.gray400 : colors.dark}
              />
            )}
          </AnimatedPressable>
        )}
      </View>

      <Animated.View style={[s.sheet, { transform: [{ translateY: sheetY }] }]}>
        {/*
          반투명 표면 한 겹. 농도는 `colors.sheetSurface`가 정한다.

          예전에는 이 위에 `BlurView`가 있었다. **안드로이드에서는 흐리게 하지 않고 흰색을
          덧칠할 뿐이다** — `expo-blur`의 기본값이 `experimentalBlurMethod: 'none'`이고, 그때
          `tint="light"`는 `rgba(249,249,249, 255×intensity×0.78)`을 배경색으로 깐다. intensity
          78이면 0.61이라, 표면과 겹쳐 실제 농도가 0.95까지 올라가 거의 흰 종이로 보였다.

          그 겹을 걷어내 농도를 한 곳에서 정한다. iOS에서 흐림이 필요해지면 다시 넣되, 그때는
          두 겹이 합쳐진 농도를 기준으로 `sheetSurface`를 다시 잡아야 한다.
        */}
        <View style={s.sheetSurface} />
        <View {...sheet.panHandlers}>
          {/*
            머리글. 홈 시트와 같은 자리에 같은 구성으로 둔다 — 손잡이, 굵은 제목 한 줄,
            그 아래 작은 글씨 한 줄. 높이를 고정하지 않고 재서(`onLayout`) 스냅 계산에 넘기므로
            글꼴 크기 설정이나 화면 폭이 달라도 카드가 어중간하게 걸리지 않는다.
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
            <View style={s.headingRow}>
              {/*
                장소명이 제목 자리를 갖는다. 연락처는 적지 않는다 — 지도 위 시트에서 전화번호는
                읽을 일이 없고, 확장하면 정보 카드에 그대로 남아 있다.
              */}
              {loading ? (
                <ActivityIndicator size="small" color={colors.gray600} style={s.headingBusy} />
              ) : (
                <Text numberOfLines={1} style={s.headingName}>
                  {place?.name ?? '장소'}
                </Text>
              )}
              {/*
                `실시간 영상핀`은 제목 자리를 장소명에 내주고 **같은 줄 반대편으로** 옮긴다.
                아래 카드 묶음이 무엇인지 알려 주는 이름표라 작은 글씨로 두고, 왼쪽 파란 점으로
                "지금 올라오는 중"임을 표시한다.
              */}
              <View style={s.liveLabel}>
                <View style={s.liveDot} />
                <Text style={s.liveText}>실시간 영상핀</Text>
              </View>
            </View>
            {/*
              주소는 제목 아래 작은 글씨 한 줄. 카카오에서 실시간으로 채우므로 비어 있을 수 있고,
              장소를 아예 불러오지 못했으면 그 자리에 이유를 적는다 — 빈 줄만 남으면 고장으로 읽힌다.
            */}
            {place !== null ? (
              place.address.length > 0 && (
                <Text numberOfLines={1} style={s.headingAddress}>
                  {place.address}
                </Text>
              )
            ) : loading ? null : (
              <Text accessibilityRole="alert" style={s.headingAddress}>
                {error ?? '장소 정보를 불러오지 못했어요.'}
              </Text>
            )}
          </Pressable>
        </View>

        <ScrollView
          /*
            **확장 단계에서만 스크롤한다.**

            "보통" 단계에서는 카드를 한 장씩 넘기므로(`PinCardPager`) 시트까지 함께 스크롤되면
            둘이 같은 세로 제스처를 두고 다툰다. 그 단계 높이는 어차피 내용에 맞춰 잡혀 있어
            스크롤할 것도 없다.
          */
          scrollEnabled={expanded}
          showsVerticalScrollIndicator={false}
          /*
            멈춘 자리를 알린다. 목록 단계에서 "지금 보고 있는 핀"을 정하는 값이다.

            **스크롤 중에는 알리지 않는다**(`onScroll`을 쓰지 않는다). 매 프레임 알리면 스크롤
            내내 지도가 따라 움직여, 손은 목록을 훑고 있는데 지도가 계속 흔들린다. 손을 뗀 뒤
            (`onScrollEndDrag`)와 관성이 멈춘 뒤(`onMomentumScrollEnd`) 한 번씩만 본다.
          */
          onScrollEndDrag={(event) => setScrollOffset(event.nativeEvent.contentOffset.y)}
          onMomentumScrollEnd={(event) => setScrollOffset(event.nativeEvent.contentOffset.y)}
          contentContainerStyle={[
            s.sheetContent,
            {
              paddingHorizontal: gutter,
              /*
                탭바가 겹치는 만큼과, 시트가 화면 밖으로 내려간 만큼(`sheet.top`)을 더한다.
                후자가 없으면 ScrollView가 화면 밖까지 자기 영역으로 알아 마지막 카드를
                끝까지 끌어올리지 못한다.
              */
              paddingBottom: navBarHeight + spacing.x10 + sheet.top,
            },
          ]}
        >
          {/*
            요일별 혼잡도 한 장. **확장 단계 전용이고, 머리글 바로 아래 첫 줄에 놓인다.**

            보통 단계에서는 그리지 않는다 — 그래야 시트가 `머리글 + 카드 한 장`이 되어 홈 시트와
            같은 높이가 된다. 확장하면 `실시간 영상핀` 이름표 바로 아랫줄에서 펼쳐져, 이 장소가
            어떤 곳인지 먼저 읽고 아래로 핀을 훑는 순서가 된다.

            **장소명·주소·연락처는 넣지 않는다.** 이름과 주소는 이미 머리글에 있어 바로 위에서
            같은 글자를 두 번 읽게 되고, 연락처는 지도 위 시트에서 쓸 일이 없다(카카오 재조회가
            실패하면 빈 문자열로 오기도 한다).

            그래프와 같은 값(`chartReveal`)으로 흐리게 나타난다. 접히는 것을 다 보여준 뒤에
            떼어 내므로(`chartMounted`) 툭 사라지지 않는다.
          */}
          {chartMounted && detail !== null && (
            <Animated.View style={[s.chartCard, { opacity: chartReveal }]}>
              {/*
                요일별 혼잡도는 추천 상세와 같은 공용 그래프다(`components/place/CrowdChart`).

                `surface`를 켜지 않는다 — 이 카드 안에 들어가므로 자기 배경을 그리면 카드가
                겹친다. 대신 이 카드의 안쪽 여백을 그래프가 전제하는 값(`CHART_CARD_PADDING`)으로
                맞춰 뒀다.

                높이를 0에서 제 높이까지 늘려 **카드가 자라면서** 드러나게 한다. 제 높이는 아래
                `chartProbe`가 미리 재 둔다. 아직 못 쟀으면 높이를 지정하지 않는다 — 부드럽지
                않을 뿐 그래프는 제 높이로 보인다.
              */}
              <Animated.View
                style={[
                  s.chartReveal,
                  chartHeight > 0 && {
                    height: chartReveal.interpolate({ inputRange: [0, 1], outputRange: [0, chartHeight] }),
                  },
                ]}
              >
                {/* 창은 제자리에 두고 안쪽이 미끄러져 들어온다. 늘어나는 것과 함께 읽힌다. */}
                <Animated.View
                  style={[
                    s.chartInner,
                    {
                      transform: [
                        {
                          translateY: chartReveal.interpolate({
                            inputRange: [0, 1],
                            outputRange: [-CHART_RISE, 0],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  <CrowdChart stats={detail.weeklyCrowdStats} />
                </Animated.View>
              </Animated.View>

              {/*
                그래프의 제 높이를 재는 자리. 재고 나면 떼어 낸다.

                **위 그래프를 그대로 재면 안 된다** — 늘어나는 상자 안에 있어 잘린 높이가 나온다.
                그 실수로 예전에 그래프가 아예 보이지 않았다. 절대 배치는 흐름 밖이라 상자 높이에
                묶이지 않고 제 높이로 눕고, 카드 배치에도 영향을 주지 않는다. 그리지 않고 누르지도
                못하게 두므로 화면에는 나타나지 않는다.
              */}
              {chartHeight === 0 && (
                <View aria-hidden pointerEvents="none" style={s.chartProbe}>
                  {/* 늘어나는 쪽과 **같은 안쪽 스타일**을 써야 잰 높이가 그대로 목표가 된다. */}
                  <View
                    style={s.chartInner}
                    onLayout={(event) => setChartHeight(Math.round(event.nativeEvent.layout.height))}
                  >
                    <CrowdChart stats={detail.weeklyCrowdStats} />
                  </View>
                </View>
              )}
            </Animated.View>
          )}

          {/*
            영상핀 카드 묶음. 머리글 오른쪽의 `실시간 영상핀`이 이 묶음의 이름표다.

            "보통" 단계는 높이가 **머리글 + 카드 한 장**으로 잡혀 있어 목록을 훑는 자리가
            아니다. 스크롤로 두면 카드가 반쯤 걸친 채 멈춰 어느 쪽도 제대로 보이지 않으므로
            한 장씩 넘긴다. 끝까지 올린 "확장" 단계는 훑는 자리라 목록으로 바뀐다.

            **단계가 바뀌어도 같은 컴포넌트가 그대로 있다.** 예전에는 단계에 따라 페이저와
            목록을 갈아 끼워, 전환하는 그 프레임에 카드가 전부 다시 만들어지면서 움직임이
            끊겼다. 지금은 `paging`만 바뀌므로 카드는 살아 있다.
          */}
          {level > 0 && pins.length > 0 && (
            /*
              칸이 스크롤 내용 안에서 어디에 있는지 재 둔다. 목록 단계에서 "지금 보고 있는 핀"은
              스크롤 위치로 정하는데, 그 위치는 시트 내용 전체 기준이라 이 칸의 윗변만큼 빼야
              칸 안에서의 위치가 된다. 위에 붙는 혼잡도 카드가 단계에 따라 생기고 사라지므로
              그 값은 고정할 수 없다.
            */
            <View onLayout={(event) => setPinListTop(event.nativeEvent.layout.y)}>
              <PinCardPager
                pins={pins}
                paging={!expanded}
                onSlotHeightChange={setPinSlotHeight}
                selectedIndex={pinIndex}
                onIndexChange={setPinIndex}
                scrollOffset={scrollOffset === null ? undefined : Math.max(0, scrollOffset - pinListTop)}
                onSelect={(pin) => router.push(`/pin/${pin.pinId}`)}
              />
            </View>
          )}

          {/* 핀이 없는 장소도 있다. 비어 있는 이유를 적어야 고장으로 읽히지 않는다. */}
          {level > 0 && !loading && detail !== null && pins.length === 0 && (
            <Text style={s.emptyPins}>지금 이곳에 올라온 영상핀이 없어요.</Text>
          )}
        </ScrollView>
      </Animated.View>

      {/*
        홈을 강조한다. 장소 상세는 홈 지도에서 이어지는 화면이라 사용자는 여전히 "홈"
        맥락에 있다(와이어프레임). 영상핀 상세(`app/pin/[pinId]`)는 게시글이라 다르다 —
        거기서는 어느 탭도 강조하지 않는다.
      */}
      <AppTabBar active="home" />
    </View>
  );
}

const shadow = {
  shadowColor: colors.dark,
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.15,
  shadowRadius: 16,
  elevation: 7,
};

const s = StyleSheet.create({
  /**
   * 이 화면은 홈 지도 위에 겹치는 오버레이다.
   *
   * 배경색을 두면 아래 지도를 가려 버린다. 반투명 모달로 띄우므로(`app/_layout.tsx`)
   * 배경 없이 두면 홈 지도가 그대로 보이고, 시트만 바뀐 것처럼 읽힌다.
   */
  overlay: { flex: 1, overflow: 'hidden' },
  /** 지도 제스처를 받는 자리. 아무것도 그리지 않고 손가락만 받는다. */
  mapGestureArea: StyleSheet.absoluteFillObject,
  topControls: { position: 'absolute' },
  /**
   * 검색바는 불투명한 흰색이다.
   *
   * 반투명(0.92)으로 두면 아래 지도가 배어 나오는데, 지도는 자리마다 색이 달라 **바 안에서
   * 흰 농도가 갈려 투톤으로 보였다.** 지도 위에 뜬 컨트롤이라 글자를 읽는 것이 먼저다.
   */
  search: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.x3,
    paddingHorizontal: spacing.x4,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    ...shadow,
  },
  searchText: { ...type.body, flex: 1, color: colors.gray600 },
  location: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
    marginTop: spacing.x3,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.94)',
    ...shadow,
  },
  /**
   * 반투명 시트. 흰 농도는 **`sheetSurface` 한 겹으로만** 정한다.
   *
   * `backgroundColor`를 두지 않는다. 표면 위아래로 흰 반투명을 더 얹으면 겹친 곳만 농도가
   * 올라가 시트가 투톤으로 갈려 보였다.
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
   * 시트의 농도를 정하는 유일한 겹. 값은 홈 시트와 공유한다(`colors.sheetSurface`).
   *
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
  /**
   * 손잡이와 머리글. **높이를 고정하지 않는다** — 내용이 정하게 두고 그 값을 재서 스냅 계산에
   * 넘긴다. 여백은 홈 시트의 머리글과 같은 값이라 두 시트의 첫 줄이 같은 높이에 놓인다.
   */
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
   * 장소명과 `실시간 영상핀` 이름표가 양끝으로 갈리는 줄.
   *
   * 높이를 글줄보다 넉넉히 잡고 가운데 정렬한다. 홈 시트의 제목 줄(`sheetHeading`)이 혼잡도
   * 토글 때문에 44를 확보하는 것과 같은 값이라, 두 시트의 첫 줄이 같은 높이에 앉는다. 손잡이
   * 바로 밑에 글자가 붙어 있던 것도 이 여유로 풀린다.
   */
  headingRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.x3,
  },
  /**
   * 장소명. flex로 남는 폭을 차지해 이름표에 밀려 잘리지 않게 한다.
   *
   * `minWidth: 0`이 없으면 긴 이름이 이름표를 화면 밖으로 밀어낸다.
   */
  headingName: { ...type.h3, flex: 1, minWidth: 0, fontWeight: '700', color: colors.dark },
  /** 이름을 기다리는 동안. 이름 자리를 그대로 차지해 도착할 때 줄이 움직이지 않는다. */
  headingBusy: { flex: 1, alignItems: 'flex-start' },
  liveLabel: { flexDirection: 'row', alignItems: 'center', gap: spacing.x1 },
  liveDot: {
    width: LIVE_DOT_SIZE,
    height: LIVE_DOT_SIZE,
    borderRadius: LIVE_DOT_SIZE / 2,
    backgroundColor: colors.blue,
  },
  liveText: { ...type.caption, color: colors.gray600 },
  /**
   * 주소 줄.
   *
   * 홈의 `현재 위치` 줄처럼 음수 여백으로 당겨 붙이지 않는다. 이쪽은 장소명이 굵고 커서
   * (`type.h3`) 바로 아래 붙으면 두 줄이 한 덩어리로 뭉쳐 읽힌다. 한 칸 띄워 둔다.
   */
  headingAddress: { ...type.caption, color: colors.gray400, marginTop: spacing.x1 },
  // paddingBottom은 바텀바 높이에 맞춰 화면에서 지정한다.
  sheetContent: { gap: spacing.x6 },
  /**
   * 요일별 혼잡도를 담는 한 장. 여백은 그래프가 전제하는 값이다.
   *
   * 그림자를 둔다 — 반투명 시트 위에 놓이므로 없으면 시트 바닥과 붙어 한 덩어리로 보인다.
   * 영상핀 카드(`PlacePinCard`)와 같은 값이라 두 카드가 같은 높이에 떠 보인다.
   */
  chartCard: {
    padding: CHART_CARD_PADDING,
    borderRadius: radius.hero,
    backgroundColor: colors.white,
    shadowColor: colors.dark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  /**
   * 그래프가 드러나는 창. 확장 단계에서만 붙는다.
   *
   * 높이를 0에서 제 높이까지 늘리므로 `overflow: hidden`이 있어야 늘어나는 동안 그래프가
   * 카드 밖으로 비어져 나오지 않는다. **여백을 여기 두지 않는다** — `margin`은 잰 높이에
   * 들어가지 않아 창이 열리는 순간 그만큼 툭 뛴다. 위 여백은 안쪽(`chartInner`)이 갖는다.
   */
  chartReveal: { overflow: 'hidden' },
  /**
   * 창 안쪽. 늘어나는 쪽과 재는 쪽이 **같은 스타일을 써야** 잰 높이가 그대로 목표가 된다.
   *
   * 위 여백이 없다. 카드에 그래프만 들어가므로 카드 자신의 여백으로 충분하다 — 예전에는 위에
   * 장소명·주소가 있어서 그 사이를 띄우려고 여백을 여기 뒀다. 여백을 다시 둘 일이 생기면
   * `margin`이 아니라 `padding`으로 둔다. `margin`은 잰 높이에 들어가지 않아 창이 열리는
   * 순간 그만큼 툭 뛴다.
   */
  chartInner: {},
  /** 그래프 높이를 재는 자리. 흐름 밖에 두어 카드 배치에 영향을 주지 않는다. */
  chartProbe: { position: 'absolute', left: 0, right: 0, top: 0, opacity: 0 },
  emptyPins: { ...type.small, color: colors.gray400, paddingVertical: spacing.x4 },
});
