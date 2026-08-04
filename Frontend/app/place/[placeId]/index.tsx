import { useCallback, useEffect, useRef, useState } from 'react';
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
import { useMapStore } from '@/store/useMapStore';
import { colors, layout, radius, spacing, type } from '@/constants/theme';

/** 손잡이 영역 높이. `s.handleArea`와 같은 값을 스냅 계산에서도 쓴다. */
const SHEET_HANDLE_HEIGHT = 28;

/**
 * 축소 단계에서 카드 아래 여백을 이만큼 줄인다.
 *
 * 축소 높이에는 탭바에 가려지지 않도록 `navBarHeight`(탭바 72 + 시스템 제스처 영역)를
 * 더한다. 그런데 실기기(갤럭시 노트20, 3버튼 내비게이션)에서는 그만큼이 **카드와 탭바 사이
 * 빈 공간으로 그대로 남았다** — 시스템 내비게이션 영역은 이미 탭바가 자기 `paddingBottom`으로
 * 처리하므로 여기서 또 비워 둘 이유가 없다.
 *
 * 시트는 화면 전체를 덮는 상자를 내려 쓰기 때문에 축소 높이를 줄이면 그만큼 카드가 탭바에
 * 가까워진다. **더 붙이거나 떼려면 이 숫자 하나만 고치면 된다.**
 */
const COLLAPSED_GAP_TRIM = spacing.x10;

/**
 * 측정이 오기 전에 쓰는 어림값.
 *
 * 첫 프레임에만 쓰이고 `onLayout` 직후 실제 값으로 바뀐다.
 */
const ESTIMATED_INFO_BODY_HEIGHT = 84;
const ESTIMATED_PIN_SLOT_HEIGHT = 240;

/**
 * "실시간 영상핀" 제목 줄의 높이.
 *
 * `s.sectionHead`의 `minHeight`와 같고, 그 안의 글줄(`type.title`의 lineHeight)도 같은 값이라
 * 실제 높이가 이 값으로 정해진다. 재지 않고 더할 수 있는 이유다.
 */
const SECTION_HEAD_HEIGHT = 26;

/**
 * 장소 카드의 안쪽 여백.
 *
 * `CrowdChart`가 자기 배경을 그리지 않을 때 **감싸는 카드의 여백이 이 값이어야 한다** —
 * 선을 그릴 폭을 그 전제로 계산한다(`CrowdChart`의 `CARD_PADDING`·`PLOT_INSET`).
 */
const INFO_CARD_PADDING = spacing.x5;

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

export default function Place() {
  const { placeId } = useLocalSearchParams<{ placeId: string }>();
  const { height } = useWindowDimensions();
  const { padding: gutter, insets } = useScreenLayout();
  const focusOn = useMapStore((state) => state.focusOn);
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

    - 축소 — 손잡이 + 장소 정보(이름·연락처·주소)
    - 기본 — 거기에 실시간 영상핀 첫 카드까지
    - 확장 — 검색바 바로 아래까지 올려 혼잡도 차트와 목록을 훑는다

    이 화면은 탭 그룹 밖이라 `<AppTabBar/>`가 절대 배치로 **화면 위에 겹친다.** 그만큼
    더 올려야 내용이 탭바 뒤로 들어가지 않는다. 홈은 탭바가 레이아웃을 차지해 이 보정이 없다.

    축소 높이는 **장소 정보 글줄만** 재서 카드 여백을 더해 잡는다. 카드 안에 혼잡도 그래프가
    같이 들어 있으므로(확장 단계에서 펼쳐진다) 카드를 통째로 재면 그래프까지 셈에 들어간다.
  */
  const [infoBodyHeight, setInfoBodyHeight] = useState(0);
  const [pinSlotHeight, setPinSlotHeight] = useState(0);

  const sheet = useBottomSheet({
    space: height,
    collapsed: Math.max(
      0,
      SHEET_HANDLE_HEIGHT +
        INFO_CARD_PADDING * 2 +
        (infoBodyHeight > 0 ? infoBodyHeight : ESTIMATED_INFO_BODY_HEIGHT) +
        navBarHeight -
        COLLAPSED_GAP_TRIM,
    ),
    /*
      "기본" 단계에서 축소보다 더 보여야 하는 높이 = 제목 줄 + 그 아래 간격 + 카드 한 칸.

      예전에는 제목과 첫 카드를 감싼 상자를 통째로 쟀다. 이제 그 자리에 목록이 될 수도 있는
      페이저가 들어가 확장 단계에서는 카드 전부의 높이가 나오므로, 잴 수 없다. 카드 한 칸의
      높이는 페이저가 알려 주고(`onSlotHeightChange`) 제목 줄은 높이가 정해져 있어 더한다.
    */
    middleExtra:
      SECTION_HEAD_HEIGHT +
      spacing.x3 +
      (pinSlotHeight > 0 ? pinSlotHeight : ESTIMATED_PIN_SLOT_HEIGHT) +
      spacing.x4,
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
    <View style={s.overlay}>
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
          <Pressable
            accessibilityRole="adjustable"
            accessibilityLabel="장소 정보 높이"
            accessibilityHint="탭하거나 위아래로 끌어 높이를 변경하세요"
            onPress={sheet.cycle}
            style={s.handleArea}
          >
            <View style={s.handle} />
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
            장소 정보와 요일별 혼잡도가 **한 장의 카드**다.

            예전에는 둘이 각자 카드였다. 같은 질문("이 장소는 어떤 곳인가")에 답하는 정보라
            한 장으로 묶는 편이 읽기 쉽고, 확장할 때 카드가 자라는 모션도 그래야 성립한다.
            추천 상세(`RecommendPlaceInfo`)가 이미 같은 구성이라 두 화면 모양도 맞는다.
          */}
          <View style={s.infoCard}>
            <View onLayout={(event) => setInfoBodyHeight(Math.round(event.nativeEvent.layout.height))}>
              {loading ? (
                <ActivityIndicator size="small" color={colors.gray600} />
              ) : place !== null ? (
                <>
                  <Text style={s.placeName}>{place.name}</Text>
                  {/* 연락처·주소는 카카오에서 실시간으로 채우므로 비어 있을 수 있다. */}
                  {place.phone !== null && place.phone.length > 0 && (
                    <Text style={s.placeMeta}>{place.phone}</Text>
                  )}
                  {place.address.length > 0 && <Text style={s.placeAddress}>{place.address}</Text>}
                </>
              ) : (
                <Text accessibilityRole="alert" style={s.placeAddress}>
                  {error ?? '장소 정보를 불러오지 못했어요.'}
                </Text>
              )}
            </View>

            {/*
              요일별 혼잡도는 추천 상세와 같은 공용 그래프다(`components/place/CrowdChart`).

              `surface`를 켜지 않는다 — 이제 이 카드 안에 들어가므로 자기 배경을 그리면 카드가
              겹친다. 대신 이 카드의 안쪽 여백을 그래프가 전제하는 값(`INFO_CARD_PADDING`)으로
              맞춰 뒀다.

              높이를 0에서 제 높이까지 늘려 **카드가 자라면서** 드러나게 한다. 제 높이는 아래
              `chartProbe`가 미리 재 둔다. 아직 못 쟀으면 높이를 지정하지 않는다 — 부드럽지
              않을 뿐 그래프는 제 높이로 보인다.
            */}
            {chartMounted && detail !== null && (
              <Animated.View
                style={[
                  s.chartReveal,
                  chartHeight > 0 && {
                    height: chartReveal.interpolate({ inputRange: [0, 1], outputRange: [0, chartHeight] }),
                  },
                  { opacity: chartReveal },
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
            )}

            {/*
              그래프의 제 높이를 재는 자리. 재고 나면 떼어 낸다.

              **위 그래프를 그대로 재면 안 된다** — 늘어나는 상자 안에 있어 잘린 높이가 나온다.
              그 실수로 예전에 그래프가 아예 보이지 않았다. 절대 배치는 흐름 밖이라 상자 높이에
              묶이지 않고 제 높이로 눕고, 카드 배치에도 영향을 주지 않는다. 그리지 않고 누르지도
              못하게 두므로 화면에는 나타나지 않는다.
            */}
            {chartHeight === 0 && detail !== null && (
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
          </View>

          {level > 0 && pins.length > 0 && (
            <View style={s.videoSection}>
              <View style={s.sectionHead}>
                <Text style={s.sectionTitle}>실시간 영상핀</Text>
              </View>

              {/*
                "보통" 단계는 높이가 **제목 + 카드 한 장**으로 잡혀 있어 목록을 훑는 자리가
                아니다. 스크롤로 두면 카드가 반쯤 걸친 채 멈춰 어느 쪽도 제대로 보이지 않으므로
                한 장씩 넘긴다. 끝까지 올린 "확장" 단계는 훑는 자리라 목록으로 바뀐다.

                **단계가 바뀌어도 같은 컴포넌트가 그대로 있다.** 예전에는 단계에 따라 페이저와
                목록을 갈아 끼워, 전환하는 그 프레임에 카드가 전부 다시 만들어지면서 움직임이
                끊겼다. 지금은 `paging`만 바뀌므로 카드는 살아 있다.
              */}
              <PinCardPager
                pins={pins}
                paging={!expanded}
                onSlotHeightChange={setPinSlotHeight}
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
  handleArea: { height: 40, alignItems: 'center', paddingTop: spacing.x3 },
  handle: { width: 40, height: 4, borderRadius: radius.pill, backgroundColor: 'rgba(59,56,56,0.32)' },
  // paddingBottom은 바텀바 높이에 맞춰 화면에서 지정한다.
  sheetContent: { gap: spacing.x6 },
  /** 장소 정보와 혼잡도 그래프를 함께 담는 한 장. 여백은 그래프가 전제하는 값이다. */
  infoCard: { padding: INFO_CARD_PADDING, borderRadius: radius.hero, backgroundColor: colors.white },
  /**
   * 그래프가 드러나는 창. 확장 단계에서만 붙는다.
   *
   * 높이를 0에서 제 높이까지 늘리므로 `overflow: hidden`이 있어야 늘어나는 동안 그래프가
   * 카드 밖으로 비어져 나오지 않는다. **여백을 여기 두지 않는다** — `margin`은 잰 높이에
   * 들어가지 않아 창이 열리는 순간 그만큼 툭 뛴다. 위 여백은 안쪽(`chartInner`)이 갖는다.
   */
  chartReveal: { overflow: 'hidden' },
  /** 창 안쪽. 위 여백을 여기 둬서 재는 높이에 포함시킨다. 재는 쪽도 같은 스타일을 쓴다. */
  chartInner: { paddingTop: spacing.x5 },
  /** 그래프 높이를 재는 자리. 흐름 밖에 두어 카드 배치에 영향을 주지 않는다. */
  chartProbe: { position: 'absolute', left: 0, right: 0, top: 0, opacity: 0 },
  placeName: { ...type.h3, fontWeight: '700', color: colors.dark },
  placeMeta: { ...type.small, color: colors.gray400, marginTop: spacing.x2 },
  placeAddress: { ...type.small, color: colors.gray400, marginTop: spacing.x1 },
  emptyPins: { ...type.small, color: colors.gray400, paddingVertical: spacing.x4 },
  videoSection: { gap: spacing.x3 },
  sectionHead: { minHeight: 26, flexDirection: 'row', alignItems: 'center' },
  sectionTitle: { ...type.title, color: colors.dark },
});
