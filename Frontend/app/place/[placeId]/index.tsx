import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { AppTabBar, useAppTabBarHeight } from '@/components/common';
import { CrowdChart, PlacePinCard } from '@/components/place';
import { usePlaceDetail } from '@/features/place-detail/hooks/usePlaceDetail';
import { useScreenLayout } from '@/hooks/useResponsivePadding';
import { useCurrentLocation } from '@/hooks/useCurrentLocation';
import { useBottomSheet } from '@/hooks/useBottomSheet';
import { useMapStore } from '@/store/useMapStore';
import { colors, layout, radius, spacing, type } from '@/constants/theme';

/** 손잡이 영역 높이. `s.handleArea`와 같은 값을 스냅 계산에서도 쓴다. */
const SHEET_HANDLE_HEIGHT = 28;

/**
 * 측정이 오기 전에 쓰는 어림값.
 *
 * 첫 프레임에만 쓰이고 `onLayout` 직후 실제 값으로 바뀐다.
 */
const ESTIMATED_INFO_HEIGHT = 104;
const ESTIMATED_VIDEO_HEIGHT = 216;

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
  */
  const [infoHeight, setInfoHeight] = useState(0);
  const [videoHeight, setVideoHeight] = useState(0);

  const sheet = useBottomSheet({
    space: height,
    collapsed: SHEET_HANDLE_HEIGHT + (infoHeight > 0 ? infoHeight : ESTIMATED_INFO_HEIGHT) + navBarHeight,
    middleExtra: (videoHeight > 0 ? videoHeight : ESTIMATED_VIDEO_HEIGHT) + spacing.x4,
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
        {level !== 2 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="현재 위치로 이동"
            accessibilityState={{ busy: myLocation.status === 'loading' }}
            disabled={myLocation.status === 'loading'}
            onPress={goToMyLocation}
            style={s.location}
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
          </Pressable>
        )}
      </View>

      <Animated.View style={[s.sheet, { transform: [{ translateY: sheetY }] }]}>
        <BlurView intensity={78} tint="light" style={StyleSheet.absoluteFill} />
        <View style={s.sheetTint} />
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
          scrollEnabled={level > 0}
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
          <View
            style={s.placeInfo}
            onLayout={(event) => setInfoHeight(Math.round(event.nativeEvent.layout.height))}
          >
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

            `surface`를 켜 그래프가 자기 카드를 그리게 한다. 이 화면에서는 장소 정보·영상핀과
            나란히 놓이는 한 장이라 배경이 있어야 통일감이 산다. 추천 상세는 이미 카드 안에
            넣으므로 켜지 않는다.
          */}
          {level === 2 && detail !== null && <CrowdChart stats={detail.weeklyCrowdStats} surface />}

          {level > 0 && pins.length > 0 && (
            <View style={s.videoSection}>
              {/*
                제목과 첫 카드를 함께 잰다. "기본" 단계에서 축소보다 더 보여야 하는 높이가
                정확히 이만큼이다. 둘을 따로 재면 사이 간격을 다시 더해야 해 어긋나기 쉽다.
              */}
              <View
                style={s.videoSection}
                onLayout={(event) => setVideoHeight(Math.round(event.nativeEvent.layout.height))}
              >
                <View style={s.sectionHead}>
                  <Text style={s.sectionTitle}>실시간 영상핀</Text>
                  <Text style={s.sectionMeta}>최근 등록순</Text>
                </View>
                <PlacePinCard pin={pins[0]} onPress={() => router.push(`/pin/${pins[0].pinId}`)} />
              </View>

              {/*
                나머지는 시트를 끝까지 올렸을 때만 그린다. 접힌 상태에서는 어차피 보이지 않는데
                미리 그리면 카드 수만큼 첫 렌더가 느려진다.
              */}
              {level === 2 &&
                pins
                  .slice(1)
                  .map((pin) => (
                    <PlacePinCard
                      key={pin.pinId}
                      pin={pin}
                      onPress={() => router.push(`/pin/${pin.pinId}`)}
                    />
                  ))}
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
  search: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.x3,
    paddingHorizontal: spacing.x4,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.92)',
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
  sheet: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    borderTopLeftRadius: radius.hero,
    borderTopRightRadius: radius.hero,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255,255,255,0.82)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    ...shadow,
  },
  sheetTint: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.04)' },
  handleArea: { height: 40, alignItems: 'center', paddingTop: spacing.x3 },
  handle: { width: 40, height: 4, borderRadius: radius.pill, backgroundColor: 'rgba(59,56,56,0.32)' },
  // paddingBottom은 바텀바 높이에 맞춰 화면에서 지정한다.
  sheetContent: { gap: spacing.x6 },
  placeInfo: { padding: spacing.x4, borderRadius: radius.lg, backgroundColor: colors.white },
  placeName: { ...type.h3, fontWeight: '700', color: colors.dark },
  placeMeta: { ...type.small, color: colors.gray400, marginTop: spacing.x2 },
  placeAddress: { ...type.small, color: colors.gray400, marginTop: spacing.x1 },
  emptyPins: { ...type.small, color: colors.gray400, paddingVertical: spacing.x4 },
  videoSection: { gap: spacing.x3 },
  sectionHead: { minHeight: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { ...type.title, color: colors.dark },
  sectionMeta: { ...type.caption, color: colors.gray600 },
});
