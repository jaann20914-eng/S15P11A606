import { useCallback, useMemo, useRef, useState } from 'react';
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
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { KakaoMap } from '@/components/home/KakaoMap';
import type { KakaoMapHandle } from '@/components/home/KakaoMap';
import type { MapViewState } from '@/components/home/kakaoMapHtml';
import { CrowdFilterToggle } from '@/components/common';
import { useAppTabBarHeight } from '@/components/common';
import { DEFAULT_CENTER, useMapStore } from '@/store/useMapStore';
import { useScreenLayout } from '@/hooks/useResponsivePadding';
import { useCurrentLocation } from '@/hooks/useCurrentLocation';
import { matchesCrowdFilter } from '@/constants/crowdLevels';
import { places } from '@/data/mock';
import { colors, layout, radius, spacing, type } from '@/constants/theme';

type SheetLevel = 0 | 1 | 2;

export default function Home() {
  const { height } = useWindowDimensions();
  const { padding: gutter, insets } = useScreenLayout();
  const crowdFilter = useMapStore((state) => state.crowdFilter);
  const setCrowdFilter = useMapStore((state) => state.setCrowdFilter);
  const selectPlace = useMapStore((state) => state.selectPlace);
  const selectedPlaceId = useMapStore((state) => state.selectedPlaceId);
  const setCenter = useMapStore((state) => state.setCenter);
  const setBounds = useMapStore((state) => state.setBounds);
  const [level, setLevel] = useState<SheetLevel>(1);
  const mapRef = useRef<KakaoMapHandle>(null);
  const myLocation = useCurrentLocation();
  const navBarHeight = useAppTabBarHeight();

  const snapPoints = useMemo(
    // 중간 단계는 장소 카드가 정확히 하나만 온전히 보이는 높이다.
    () => [Math.max(0, height - 92), Math.max(insets.top + 160, height - 372), Math.max(insets.top + 84, 96)],
    [height, insets.top],
  );
  const sheetY = useRef(new Animated.Value(snapPoints[1])).current;
  const dragStart = useRef(snapPoints[1]);

  const moveTo = useCallback(
    (next: SheetLevel) => {
      setLevel(next);
      Animated.spring(sheetY, {
        toValue: snapPoints[next],
        useNativeDriver: true,
        damping: 24,
        stiffness: 220,
        mass: 0.8,
      }).start();
    },
    [snapPoints, sheetY],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 5,
        onPanResponderGrant: () => {
          dragStart.current = snapPoints[level];
        },
        onPanResponderMove: (_, gesture) => {
          const nextY = Math.min(snapPoints[0], Math.max(snapPoints[2], dragStart.current + gesture.dy));
          sheetY.setValue(nextY);
        },
        onPanResponderRelease: (_, gesture) => {
          const projected = dragStart.current + gesture.dy + gesture.vy * 72;
          const nearest = snapPoints.reduce(
            (best, point, index) =>
              Math.abs(point - projected) < Math.abs(snapPoints[best] - projected) ? index : best,
            0,
          ) as SheetLevel;
          moveTo(nearest);
        },
      }),
    [level, moveTo, snapPoints, sheetY],
  );

  const visiblePlaces = useMemo(
    () => places.filter((place) => matchesCrowdFilter(place.crowdLevel, crowdFilter)),
    [crowdFilter],
  );

  const markers = useMemo(
    () => visiblePlaces.map(({ id, name, latitude, longitude }) => ({ id, name, latitude, longitude })),
    [visiblePlaces],
  );

  const openPlace = (placeId: string) => {
    selectPlace(placeId);
    router.push(`/place/${placeId}`);
  };

  /** 핀 탭은 상세로 바로 넘어가지 않고 해당 장소를 지도 중앙에 두고 목록을 함께 보여준다. */
  const focusPlace = useCallback(
    (placeId: string) => {
      const place = places.find((item) => item.id === placeId);
      if (!place) return;

      selectPlace(placeId);
      mapRef.current?.panTo({ latitude: place.latitude, longitude: place.longitude });
      if (level === 2) moveTo(1);
    },
    [level, moveTo, selectPlace],
  );

  const handleViewChange = useCallback(
    (view: MapViewState) => {
      setCenter({ latitude: view.latitude, longitude: view.longitude });
      setBounds({
        southWest: { latitude: view.bounds.swLat, longitude: view.bounds.swLng },
        northEast: { latitude: view.bounds.neLat, longitude: view.bounds.neLng },
      });
    },
    [setBounds, setCenter],
  );

  const clearSelection = useCallback(() => selectPlace(null), [selectPlace]);

  /** 현재 위치 버튼: 권한을 받아 실제 좌표로 이동하고, 그 자리에 내 위치 마커를 찍는다. */
  const goToMyLocation = useCallback(async () => {
    const coordinate = await myLocation.request();
    if (coordinate) mapRef.current?.panTo(coordinate);
  }, [myLocation]);

  // 바텀시트가 가리는 높이. 지도 중심 이동 시 이만큼 보정해 보이는 영역의 중앙에 놓는다.
  const coveredHeight = Math.max(0, height - snapPoints[level]);

  return (
    <View style={s.screen}>
      <KakaoMap
        ref={mapRef}
        fullScreen
        center={DEFAULT_CENTER}
        myLocation={myLocation.coordinate}
        bottomInset={coveredHeight}
        places={markers}
        filter={crowdFilter}
        selectedPlaceId={selectedPlaceId}
        onReady={() => mapRef.current?.fitPlaces()}
        onPinPress={focusPlace}
        onMapPress={clearSelection}
        onViewChange={handleViewChange}
      />

      {/* 검색바와 그 바로 아래 오른쪽에 붙는 현재 위치 버튼 (와이어프레임 기준).
          box-none이 없으면 두 요소 사이 빈 공간이 지도 드래그를 가로챈다. */}
      <View
        pointerEvents="box-none"
        style={[s.mapTop, { top: insets.top + spacing.x3, left: gutter, right: gutter }]}
      >
        <Pressable style={s.search} onPress={() => router.push('/(tabs)/home/search')}>
          <Ionicons name="search" size={22} color={colors.gray600} />
          <Text style={s.searchText}>장소명이나 태그를 검색해보세요</Text>
        </Pressable>
        <Pressable
          accessibilityLabel="현재 위치로 돌아가기"
          accessibilityState={{ busy: myLocation.status === 'loading' }}
          onPress={goToMyLocation}
          style={s.location}
        >
          <Ionicons
            name={myLocation.status === 'granted' ? 'locate' : 'locate-outline'}
            size={23}
            color={myLocation.status === 'denied' ? colors.gray400 : colors.dark}
          />
        </Pressable>
      </View>

      <Animated.View style={[s.sheet, { transform: [{ translateY: sheetY }] }]}>
        <BlurView intensity={78} tint="light" style={StyleSheet.absoluteFill} />
        <View style={s.sheetTint} />

        <View {...panResponder.panHandlers}>
          <Pressable
            accessibilityRole="adjustable"
            accessibilityLabel="장소 목록 높이"
            accessibilityHint="탭하거나 위아래로 끌어 높이를 변경하세요"
            onPress={() => moveTo(((level + 1) % 3) as SheetLevel)}
            style={[s.handleArea, level === 0 && s.handleAreaCollapsed]}
          >
            <View style={s.handle} />
            <View style={s.sheetHeading}>
              <Text numberOfLines={1} style={s.sheetTitle}>
                주위를 둘러볼까요?
              </Text>
              <CrowdFilterToggle value={crowdFilter} onChange={setCrowdFilter} />
            </View>
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          scrollEnabled={level > 0}
          contentContainerStyle={[
            s.list,
            // 바텀바(+ 기기 시스템 바)에 마지막 카드가 가리지 않도록 확보한다.
            { paddingHorizontal: gutter, paddingBottom: navBarHeight + spacing.x6 },
          ]}
        >
          {visiblePlaces.map((place) => (
            <Pressable key={place.id} onPress={() => openPlace(place.id)} style={s.placeCard}>
              <View style={s.cardTop}>
                <View style={s.placeCopy}>
                  <Text numberOfLines={1} style={s.placeName}>
                    {place.name}
                  </Text>
                  <Text style={s.hours}>영업중 · 오후 10:00까지</Text>
                  <Text numberOfLines={1} style={s.address}>
                    {place.address}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={22} color={colors.gray400} />
              </View>
              <View style={s.cardRule} />
              <Text style={s.pinUpload}>감지카메라 외 {place.pins}명이 핀을 업로드했습니다</Text>
              <View style={s.angleRow}>
                {[320, 90, 270, 90, 180].map((angle, index) => (
                  <View key={`${place.id}-${index}`} style={s.angleRing}>
                    <Text style={s.angleText}>{angle}°</Text>
                  </View>
                ))}
                <Text style={s.morePins}>+{place.pins}</Text>
              </View>
            </Pressable>
          ))}
          {visiblePlaces.length === 0 && (
            <View style={s.empty}>
              <Text style={s.emptyTitle}>조건에 맞는 장소가 없어요</Text>
              <Text style={s.emptyText}>다른 혼잡도 필터를 선택해보세요.</Text>
            </View>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const glassShadow = {
  shadowColor: '#282626',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.14,
  shadowRadius: 18,
  elevation: 7,
};

const s = StyleSheet.create({
  screen: { flex: 1, overflow: 'hidden', backgroundColor: '#E9EEE8' },
  mapTop: { position: 'absolute' },
  search: {
    height: layout.searchHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.x3,
    paddingHorizontal: spacing.x4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.82)',
    backgroundColor: 'rgba(255,255,255,0.88)',
    ...glassShadow,
  },
  searchText: { ...type.body, flex: 1, color: colors.gray600 },
  location: {
    width: 48,
    height: 48,
    alignSelf: 'flex-end',
    marginTop: spacing.x3,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.92)',
    ...glassShadow,
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
    ...glassShadow,
  },
  sheetTint: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.04)' },
  handleArea: {
    height: 76,
    paddingTop: spacing.x2,
    paddingBottom: spacing.x2,
    paddingHorizontal: spacing.x5,
  },
  handleAreaCollapsed: { height: 92 },
  handle: {
    width: 40,
    height: 4,
    alignSelf: 'center',
    borderRadius: radius.pill,
    backgroundColor: 'rgba(59,56,56,0.28)',
    marginBottom: spacing.x1,
  },
  sheetHeading: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.x3,
  },
  sheetTitle: { ...type.body, fontSize: 17, lineHeight: 26, color: colors.dark, fontWeight: '600' },
  list: { paddingTop: 0, gap: spacing.x3 },
  placeCard: {
    padding: spacing.x5,
    borderRadius: radius.card,
    backgroundColor: 'rgba(255,255,255,0.96)',
    ...glassShadow,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.x3 },
  placeCopy: { flex: 1, minWidth: 0 },
  placeName: { ...type.title, flex: 1, color: colors.dark },
  hours: { ...type.caption, color: colors.gray600, marginTop: spacing.x1 },
  address: { ...type.caption, color: colors.gray400, marginTop: spacing.x1 },
  cardRule: { width: 64, height: 1, backgroundColor: colors.gray200, marginVertical: spacing.x3 },
  pinUpload: { ...type.caption, color: colors.gray400 },
  angleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.x2, marginTop: spacing.x3 },
  angleRing: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.lime,
    backgroundColor: colors.white,
  },
  angleText: { fontSize: 10, lineHeight: 14, color: colors.gray600 },
  morePins: { ...type.caption, color: colors.gray600, marginLeft: spacing.x1 },
  empty: { alignItems: 'center', paddingVertical: spacing.x10 },
  emptyTitle: { ...type.title, color: colors.dark },
  emptyText: { ...type.small, color: colors.gray600, marginTop: spacing.x2 },
});
