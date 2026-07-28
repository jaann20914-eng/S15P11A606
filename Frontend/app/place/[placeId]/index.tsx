import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
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
import { KakaoMap } from '@/components/home/KakaoMap';
import type { KakaoMapHandle } from '@/components/home/KakaoMap';
import type { ResolvedPlace } from '@/components/home/kakaoMapHtml';
import { StaticBottomNav, useNavBarHeight } from '@/components/common/BottomNav';
import type { NavTab } from '@/components/common/BottomNav';
import { useScreenLayout } from '@/hooks/useResponsivePadding';
import { useCurrentLocation } from '@/hooks/useCurrentLocation';
import { useMapStore } from '@/store/useMapStore';
import { places } from '@/data/mock';
import { colors, radius, spacing, type } from '@/constants/theme';

type SheetLevel = 0 | 1 | 2;

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

/** 탭 밖 화면이라 탭 네비게이션이 없다. 같은 규격의 바를 그리고 라우팅만 직접 처리한다. */
const tabRoutes: Record<NavTab, string> = {
  home: '/(tabs)/home',
  recommend: '/(tabs)/recommend',
  chat: '/(tabs)/chat/sent',
  mypage: '/(tabs)/mypage',
};

export default function Place() {
  const { placeId } = useLocalSearchParams<{ placeId: string }>();
  const { height } = useWindowDimensions();
  const { padding: gutter, insets } = useScreenLayout();
  const crowdFilter = useMapStore((state) => state.crowdFilter);
  const [level, setLevel] = useState<SheetLevel>(1);
  const mapRef = useRef<KakaoMapHandle>(null);
  const myLocation = useCurrentLocation();
  const navBarHeight = useNavBarHeight();

  /** 백엔드 연동 전이라 목업 장소를 기준으로 삼고, 실제 좌표·주소는 장소명 검색으로 채운다. */
  const mockPlace = places.find((item) => item.id === placeId) ?? places[0];
  const [resolved, setResolved] = useState<ResolvedPlace | null>(null);
  const [searchFailed, setSearchFailed] = useState(false);
  const snapPoints = useMemo(
    () => [height - 196, Math.round(height * 0.46), Math.max(insets.top + 138, 154)],
    [height, insets.top],
  );
  const sheetY = useRef(new Animated.Value(snapPoints[1])).current;
  const dragStart = useRef(snapPoints[1]);

  const moveTo = (next: SheetLevel) => {
    setLevel(next);
    Animated.spring(sheetY, {
      toValue: snapPoints[next],
      useNativeDriver: true,
      damping: 24,
      stiffness: 220,
    }).start();
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 5,
        onPanResponderGrant: () => {
          dragStart.current = snapPoints[level];
        },
        onPanResponderMove: (_, gesture) =>
          sheetY.setValue(Math.min(snapPoints[0], Math.max(snapPoints[2], dragStart.current + gesture.dy))),
        onPanResponderRelease: (_, gesture) => {
          const projected = dragStart.current + gesture.dy + gesture.vy * 70;
          const nearest = snapPoints.reduce(
            (best, point, index) =>
              Math.abs(point - projected) < Math.abs(snapPoints[best] - projected) ? index : best,
            0,
          ) as SheetLevel;
          moveTo(nearest);
        },
      }),
    [level, sheetY, snapPoints],
  );

  const coveredHeight = Math.max(0, height - snapPoints[level]);

  /**
   * 백엔드 좌표 연동 전 임시 경로: 지도가 준비되면 장소명으로 검색해 좌표·주소를 채운다.
   * 지도 SDK의 services(장소 검색)를 그대로 쓴다.
   */
  const handleMapReady = useCallback(() => {
    mapRef.current?.searchPlace(mockPlace.name);
  }, [mockPlace.name]);

  const handleResolved = useCallback((place: ResolvedPlace) => {
    setResolved(place);
    setSearchFailed(false);
  }, []);

  /** 검색이 안 되면 등록된 좌표로라도 지도를 맞춘다. */
  const handleNotFound = useCallback(
    (keyword: string, reason: string) => {
      if (__DEV__) console.warn(`[place] "${keyword}" 검색 실패 (${reason})`);
      setSearchFailed(true);
      mapRef.current?.panTo({ latitude: mockPlace.latitude, longitude: mockPlace.longitude });
    },
    [mockPlace.latitude, mockPlace.longitude],
  );

  const goToMyLocation = useCallback(async () => {
    const coordinate = await myLocation.request();
    if (coordinate) mapRef.current?.panTo(coordinate);
  }, [myLocation]);

  const marker = useMemo(
    () => [
      {
        id: mockPlace.id,
        name: resolved?.name ?? mockPlace.name,
        latitude: resolved?.latitude ?? mockPlace.latitude,
        longitude: resolved?.longitude ?? mockPlace.longitude,
      },
    ],
    [mockPlace, resolved],
  );

  return (
    <View style={s.screen}>
      <KakaoMap
        ref={mapRef}
        fullScreen
        center={{ latitude: mockPlace.latitude, longitude: mockPlace.longitude }}
        myLocation={myLocation.coordinate}
        bottomInset={coveredHeight}
        places={marker}
        filter={crowdFilter}
        selectedPlaceId={mockPlace.id}
        onReady={handleMapReady}
        onPlaceResolved={handleResolved}
        onPlaceNotFound={handleNotFound}
        onPinPress={() => router.push('/pin/1')}
      />

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
          <Pressable accessibilityLabel="현재 위치로 이동" onPress={goToMyLocation} style={s.location}>
            <Ionicons
              name={myLocation.status === 'granted' ? 'locate' : 'locate-outline'}
              size={22}
              color={myLocation.status === 'denied' ? colors.gray400 : colors.dark}
            />
          </Pressable>
        )}
      </View>

      <Animated.View style={[s.sheet, { transform: [{ translateY: sheetY }] }]}>
        <BlurView intensity={78} tint="light" style={StyleSheet.absoluteFill} />
        <View style={s.sheetTint} />
        <View {...panResponder.panHandlers}>
          <Pressable onPress={() => moveTo(((level + 1) % 3) as SheetLevel)} style={s.handleArea}>
            <View style={s.handle} />
          </Pressable>
        </View>

        <ScrollView
          scrollEnabled={level > 0}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            s.sheetContent,
            { paddingHorizontal: gutter, paddingBottom: navBarHeight + spacing.x10 },
          ]}
        >
          <View style={s.placeInfo}>
            <Text style={s.placeName}>{resolved?.name ?? mockPlace.name}</Text>
            {resolved?.phone ? <Text style={s.placeMeta}>연락처 : {resolved.phone}</Text> : null}
            <Text style={s.placeAddress}>
              {resolved?.roadAddress || resolved?.address || mockPlace.address}
            </Text>
            {searchFailed && <Text style={s.placeNotice}>검색 결과가 없어 등록된 좌표로 표시했어요.</Text>}
          </View>

          {level === 2 && <CrowdChart />}

          {level > 0 && (
            <View style={s.videoSection}>
              <View style={s.sectionHead}>
                <Text style={s.sectionTitle}>실시간 영상핀</Text>
                <Text style={s.sectionMeta}>최근 등록순</Text>
              </View>
              <VideoCard />
              {level === 2 && <VideoCard index={1} />}
            </View>
          )}
        </ScrollView>
      </Animated.View>

      <StaticBottomNav
        active="home"
        onPressTab={(tab) => router.push(tabRoutes[tab] as never)}
        onPressCapture={() => router.push('/(tabs)/write')}
      />
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
  screen: { flex: 1, overflow: 'hidden', backgroundColor: '#E9EEE8' },
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
