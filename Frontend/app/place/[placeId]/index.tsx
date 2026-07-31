import { useCallback, useEffect, useState } from 'react';
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
import { LinearGradient } from 'expo-linear-gradient';
import { AppTabBar, useAppTabBarHeight } from '@/components/common';
import { useScreenLayout } from '@/hooks/useResponsivePadding';
import { useCurrentLocation } from '@/hooks/useCurrentLocation';
import { useBottomSheet } from '@/hooks/useBottomSheet';
import { useMapStore } from '@/store/useMapStore';
import { usesMockApi } from '@/api/config';
import { places } from '@/data/mock';
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

const chartValues = [64, 52, 30, 42, 53, 38, 68];
const days = ['월', '화', '수', '목', '금', '토', '일'];

function CrowdChart() {
  const { width } = useWindowDimensions();
  const plotWidth = Math.min(width - 106, 292);
  const plotHeight = 82;
  const step = plotWidth / 6;
  return (
    <View style={s.chartCard}>
      <Text style={s.chartTitle}>요일별 혼잡도</Text>
      <View style={s.chartBody}>
        <View style={s.axisLabels}>
          <Text style={s.axisText}>붐빔</Text>
          <Text style={s.axisText}>여유</Text>
        </View>
        <View style={[s.chartArea, { width: plotWidth, height: plotHeight }]}>
          <View style={[s.gridLine, { top: 8 }]} />
          <View style={[s.gridLine, s.middleLine, { top: plotHeight / 2 }]} />
          <View style={[s.gridLine, { top: plotHeight - 2 }]} />
          <LinearGradient
            colors={['rgba(196,230,0,.24)', 'rgba(196,230,0,.02)']}
            style={[s.chartFill, { top: 25 }]}
          />
          {chartValues.slice(0, -1).map((value, index) => {
            const next = chartValues[index + 1];
            const dx = step;
            const dy = next - value;
            const length = Math.sqrt(dx * dx + dy * dy);
            const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
            return (
              <View
                key={`line-${index}`}
                style={[
                  s.lineSegment,
                  { left: index * step, top: value, width: length, transform: [{ rotate: `${angle}deg` }] },
                ]}
              />
            );
          })}
          {chartValues.map((value, index) => (
            <View
              key={index}
              style={[
                s.chartDot,
                index === 2 && s.chartDotActive,
                { left: index * step - 5, top: value - 5 },
              ]}
            />
          ))}
          <View style={[s.chartTooltip, { left: step * 2 - 23, top: 0 }]}>
            <Text style={s.tooltipText}>붐빔</Text>
          </View>
        </View>
      </View>
      <View style={s.dayRow}>
        {days.map((day) => (
          <View key={day} style={[s.dayChip, day === '수' && s.dayChipActive]}>
            <Text style={[s.dayText, day === '수' && s.dayTextActive]}>{day}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * 목업 핀 번호별 상황.
 *
 * 실기에서는 주소를 직접 칠 수 없어 목록에서 눌러 들어가야 한다. 어느 카드가 어떤 화면인지
 * 알 수 있도록 목업 모드에서만 표시한다. 서버가 붙으면 사라진다.
 */
const MOCK_PIN_LABELS = [
  '결제 전',
  '열람 완료',
  '평가 완료',
  '내 핀',
  '결제 시 크레딧 부족',
  '내 핀 · 삭제 실패',
];

function VideoCard({ index = 0 }: { index?: number }) {
  return (
    <Pressable onPress={() => router.push(`/pin/${index + 1}`)} style={s.videoCard}>
      <View style={s.authorRow}>
        <View style={s.viewRing} accessibilityLabel="뷰 각도 92도">
          <Text style={s.viewRingText}>92°</Text>
        </View>
        <View style={s.authorCopy}>
          <Text style={s.authorName}>도장깨기 준호</Text>
          <Text style={s.time}>2분 전</Text>
        </View>
      </View>
      <View style={s.videoBody}>
        <View style={[s.thumbnail, index === 1 && { backgroundColor: '#C9E5E0' }]}>
          <Ionicons name="videocam-outline" size={25} color="rgba(59,56,56,0.55)" />
        </View>
        <View style={s.memoWrap}>
          <Text numberOfLines={5} style={s.memo}>
            저희 곧 카페 나갈건데, 창가 자리 앉으실 분 있으실까요? 3시 30분까지 채팅주시면 자리 전달해드릴 수
            있을 것 같습니다.
            {usesMockApi && MOCK_PIN_LABELS[index] ? ` (${index + 1}. ${MOCK_PIN_LABELS[index]})` : ''}
          </Text>
          <View style={s.tags}>
            {['#카페', '#감성', '#강남맛집'].map((tag) => (
              <View key={tag} style={s.tag}>
                <Text numberOfLines={1} ellipsizeMode="tail" style={s.tagText}>
                  {tag}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export default function Place() {
  const { placeId } = useLocalSearchParams<{ placeId: string }>();
  const { height } = useWindowDimensions();
  const { padding: gutter, insets } = useScreenLayout();
  const focusOn = useMapStore((state) => state.focusOn);
  const myLocation = useCurrentLocation();
  const navBarHeight = useAppTabBarHeight();

  /**
   * 백엔드 연동 전이라 목업 장소를 기준으로 삼는다.
   *
   * 예전에는 이 화면이 자기 지도를 띄우고 SDK의 장소 검색으로 주소·연락처를 채웠다. 지도를
   * 없애면서 그 경로도 사라졌다. 원래 출처는 `GET /api/v1/places`이고, 그 응답
   * (`PlaceListItem`)에 `address`와 `phone`이 이미 있다 — 연동되면 여기서 받아 쓴다.
   */
  const mockPlace = places.find((item) => item.id === placeId) ?? places[0];
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
    이 화면에 들어오면 아래 깔린 홈 지도를 이 장소로 옮긴다.
    지도를 새로 만들지 않으므로 재로드도, 전환 연출도 없다.
  */
  useEffect(() => {
    focusOn({
      coordinate: { latitude: mockPlace.latitude, longitude: mockPlace.longitude },
      name: mockPlace.name,
    });
  }, [focusOn, mockPlace.latitude, mockPlace.longitude, mockPlace.name]);

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
            <Text style={s.placeName}>{mockPlace.name}</Text>
            <Text style={s.placeAddress}>{mockPlace.address}</Text>
          </View>

          {level === 2 && <CrowdChart />}

          {level > 0 && (
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
                <VideoCard />
              </View>

              {/*
                목업에서는 여섯 가지 상황을 모두 눌러볼 수 있게 카드를 다 그린다.
                실기에서는 주소를 직접 칠 수 없어 목록이 유일한 진입 경로다.
              */}
              {usesMockApi
                ? MOCK_PIN_LABELS.slice(1).map((label, index) => <VideoCard key={label} index={index + 1} />)
                : level === 2 && <VideoCard index={1} />}
            </View>
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
  placeNotice: { ...type.caption, color: colors.gray400, marginTop: spacing.x2 },
  chartCard: { padding: spacing.x4, borderRadius: radius.card, backgroundColor: colors.white },
  chartTitle: { ...type.label, fontWeight: '600', color: colors.dark, marginBottom: spacing.x3 },
  chartBody: { flexDirection: 'row', alignItems: 'stretch' },
  axisLabels: { width: 30, justifyContent: 'space-between', paddingVertical: 2 },
  axisText: { fontSize: 10, lineHeight: 14, color: colors.gray400 },
  chartArea: { position: 'relative', overflow: 'visible' },
  gridLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: colors.gray100 },
  middleLine: {
    height: 0,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderTopColor: colors.gray200,
    backgroundColor: 'transparent',
  },
  chartFill: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  lineSegment: {
    position: 'absolute',
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.lime,
    transformOrigin: 'left center' as any,
  },
  chartDot: {
    position: 'absolute',
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 3,
    borderColor: colors.lime,
    backgroundColor: colors.white,
  },
  chartDotActive: {
    width: 15,
    height: 15,
    marginLeft: -2,
    marginTop: -2,
    borderWidth: 2,
    borderColor: colors.white,
    backgroundColor: colors.lime,
    shadowColor: colors.dark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.16,
    shadowRadius: 4,
    elevation: 3,
  },
  chartTooltip: {
    position: 'absolute',
    minWidth: 48,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.dark,
  },
  tooltipText: { fontSize: 10, lineHeight: 14, fontWeight: '600', color: colors.white },
  dayRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.x3, paddingLeft: 30 },
  dayChip: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  dayChipActive: { borderColor: colors.lime, backgroundColor: colors.lime },
  dayText: { fontSize: 14, lineHeight: 20, fontWeight: '500', color: colors.dark },
  dayTextActive: { color: colors.dark, fontWeight: '700' },
  videoSection: { gap: spacing.x3 },
  sectionHead: { minHeight: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { ...type.title, color: colors.dark },
  sectionMeta: { ...type.caption, color: colors.gray600 },
  videoCard: {
    padding: spacing.x4,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.gray200,
    backgroundColor: 'rgba(255,255,255,0.97)',
    ...shadow,
  },
  authorRow: { flexDirection: 'row', alignItems: 'center' },
  viewRing: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.lime,
    backgroundColor: colors.white,
  },
  viewRingText: { fontSize: 11, lineHeight: 15, fontWeight: '500', color: colors.gray600 },
  authorCopy: { marginLeft: spacing.x2 },
  authorName: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: colors.dark },
  time: { fontSize: 12, lineHeight: 18, letterSpacing: 0.1, fontWeight: '400', color: colors.gray400 },
  videoBody: { flexDirection: 'row', alignItems: 'stretch', gap: spacing.x2, marginTop: spacing.x3 },
  thumbnail: {
    width: 128,
    minHeight: 112,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#94D8D4',
  },
  memoWrap: { flex: 1, minWidth: 0 },
  memo: { fontSize: 14, lineHeight: 21, letterSpacing: 0, fontWeight: '400', color: colors.gray600 },
  tags: { flexDirection: 'row', gap: spacing.x1, marginTop: spacing.x2, overflow: 'hidden' },
  tag: {
    maxWidth: '45%',
    height: 28,
    flexShrink: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.x2,
    borderRadius: radius.pill,
    backgroundColor: colors.limeSoft,
  },
  tagText: { ...type.caption, flexShrink: 1, color: colors.gray600 },
  bottomNav: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 72,
    flexDirection: 'row',
    paddingTop: spacing.x2,
    paddingBottom: spacing.x2,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
    backgroundColor: colors.white,
  },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  navLabel: { ...type.caption, fontSize: 11, lineHeight: 16, color: colors.gray400, fontWeight: '600' },
  navLabelActive: { color: colors.dark },
  captureButton: {
    width: 58,
    height: 58,
    marginTop: -29,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 19,
    borderWidth: 3,
    borderColor: colors.white,
    backgroundColor: '#D9ED76',
    ...shadow,
  },
  captureLabel: { marginTop: spacing.x2 },
});
