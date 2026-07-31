import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { KakaoMap } from '@/components/home/KakaoMap';
import type { KakaoMapHandle } from '@/components/home/KakaoMap';
import type { MapViewState } from '@/components/home/kakaoMapHtml';
import { CrowdFilterToggle } from '@/components/common';
import { useAppTabBarHeight } from '@/components/common';
import { DEFAULT_CENTER, useMapStore } from '@/store/useMapStore';
import type { Coordinate } from '@/store/useMapStore';
import { useScreenLayout } from '@/hooks/useResponsivePadding';
import { useCurrentLocation } from '@/hooks/useCurrentLocation';
import { matchesCrowdFilter } from '@/constants/crowdLevels';
import { places } from '@/data/mock';
import { colors, layout, radius, spacing, type } from '@/constants/theme';

type SheetLevel = 0 | 1 | 2;

/**
 * 내 위치를 기다리는 한계 시간(ms).
 *
 * 캐시된 위치가 있으면 즉시 오므로 대부분 이 시간을 쓰지 않는다. 새로 측위해야 하는
 * 경우에만 걸리고, 넘기면 기본 중심으로 먼저 띄운다 — 지도가 안 보이는 것보다는 낫다.
 */
const MY_LOCATION_WAIT_MS = 1500;

/**
 * 측정이 오기 전에 쓰는 어림값.
 *
 * 첫 프레임에만 쓰이고 `onLayout` 직후 실제 값으로 바뀐다. 0으로 두면 시트가 화면 전체를
 * 덮은 채 시작해 눈에 띄게 튀므로, 실제와 가까운 값을 둔다.
 */
const ESTIMATED_HEADER_HEIGHT = 118;
const ESTIMATED_CARD_HEIGHT = 208;

export default function Home() {
  const { height } = useWindowDimensions();
  const { padding: gutter, insets } = useScreenLayout();
  const crowdFilter = useMapStore((state) => state.crowdFilter);
  const setCrowdFilter = useMapStore((state) => state.setCrowdFilter);
  const selectPlace = useMapStore((state) => state.selectPlace);
  const selectedPlaceId = useMapStore((state) => state.selectedPlaceId);
  const setCenter = useMapStore((state) => state.setCenter);
  const setBounds = useMapStore((state) => state.setBounds);
  const focus = useMapStore((state) => state.focus);
  const clearFocus = useMapStore((state) => state.clearFocus);
  const [mapReady, setMapReady] = useState(false);

  /**
   * 지도를 시작할 지점. 정해지기 전에는 지도를 띄우지 않는다.
   *
   * `KakaoMap`은 최초 중심을 첫 렌더에 HTML로 심으므로, 나중에 옮기면 엉뚱한 동네 타일을
   * 받아 놓고 버리게 된다. 그래서 좌표를 먼저 기다린다.
   *
   * 내 위치를 얻었으면 그 자리에서 시작하고 핀 맞춤은 하지 않는다 — 핀에 맞추면 방금 잡은
   * 중심을 곧바로 덮어써 버린다. 못 얻었으면 기존 동작(기본 중심 + 핀 맞춤)으로 돌아간다.
   */
  const [start, setStart] = useState<{ center: Coordinate; fromMyLocation: boolean } | null>(null);

  /**
   * 옮겨 갈 좌표를 한 렌더 동안 들고 있는다.
   *
   * 지도 중심 보정은 **바텀시트가 가리는 높이**를 기준으로 계산한다. 카드를 누르면 시트
   * 높이도 함께 바뀔 수 있는데, 같은 tick에 바로 옮기면 아직 바뀌기 전 높이로 계산해
   * 장소가 화면 중앙에서 벗어난 자리에 놓인다.
   *
   * 한 번 더 렌더된 뒤에 옮기면 새 높이가 반영돼 있다. 검색 복귀도 같은 길을 쓰게 해서
   * 이동 경로를 하나로 둔다.
   */
  const [pendingPan, setPendingPan] = useState<Coordinate | null>(null);
  const [level, setLevel] = useState<SheetLevel>(1);
  const mapRef = useRef<KakaoMapHandle>(null);
  // 지도를 내 위치에서 시작하려면 첫 렌더 전에 좌표가 있어야 한다. 권한은 묻지 않는다.
  const myLocation = useCurrentLocation({ auto: true });
  const navBarHeight = useAppTabBarHeight();

  /*
    시트 헤더와 첫 카드의 실제 높이. 스냅 위치를 이 값으로 계산한다.

    예전에는 92·372 같은 숫자를 박아 두었는데, 두 가지가 어긋났다. 하단 탭바가 시트 위에
    떠 있다는 것을 계산에 넣지 않아 접었을 때 제목이 탭바 뒤로 잘렸고, 글꼴 크기 설정이나
    화면 폭에 따라 내용 높이가 달라지면 카드가 어중간하게 걸렸다.

    측정값을 쓰면 "헤더만", "헤더 + 카드 하나"가 기기와 무관하게 정확히 맞는다.
  */
  const [headerHeight, setHeaderHeight] = useState(0);
  const [cardHeight, setCardHeight] = useState(0);

  /**
   * 시트가 놓이는 영역의 높이. `useWindowDimensions()`의 창 높이와 **다르다.**
   *
   * 탭 네비게이터는 탭바를 화면 컨테이너의 형제로 세로로 쌓는다(`BottomTabView`). 그래서
   * 이 화면에 주어진 높이는 `창 높이 - 탭바`다. 창 높이로 스냅을 계산하면 시트 전체가
   * 탭바 두께만큼 아래로 밀려, 접었을 때 헤더가 화면 밖으로 나가 버린다.
   *
   * 직접 재면 탭바가 자리를 차지하든 겹치든 항상 맞는다.
   */
  const [screenHeight, setScreenHeight] = useState(0);
  // 재기 전 첫 프레임용 어림값. 탭바를 뺀 값이라 측정값과 거의 같다.
  const sheetSpace = screenHeight > 0 ? screenHeight : Math.max(0, height - navBarHeight);

  /**
   * 3단계 시트 높이. 값은 시트 **위쪽 y좌표**이므로 작을수록 크게 열린 상태다.
   *
   * - `0` 축소 — 헤더만 보인다
   * - `1` 기본 — 헤더 + 장소 카드 하나가 온전히 보인다
   * - `2` 확장 — 화면 위쪽까지 열어 목록을 훑는다
   *
   * 측정 전에는 대략값으로 두고, `onLayout`이 오면 다시 계산된다.
   */
  const snapPoints = useMemo(() => {
    const header = headerHeight > 0 ? headerHeight : ESTIMATED_HEADER_HEIGHT;
    const card = cardHeight > 0 ? cardHeight : ESTIMATED_CARD_HEIGHT;

    // 축소 — 헤더만. 탭바는 이 영역 밖에 있으므로 더 보탤 것이 없다.
    const collapsed = header;
    // 기본 — 헤더 + 카드 하나. 카드 아래로 약간의 여백을 둬 잘려 보이지 않게 한다.
    const middle = header + card + spacing.x4;
    /*
      확장 — 검색바 바로 아래. 검색바는 `insets.top + spacing.x3`에서 시작해
      `layout.searchHeight`만큼 차지하므로, 그 끝에서 한 칸 띄운 자리가 상한이다.
      예전에는 `insets.top + spacing.x6`으로 올려 검색바와 겹쳤다.
    */
    const expandedTop = insets.top + spacing.x3 + layout.searchHeight + spacing.x4;

    const collapsedTop = Math.max(0, sheetSpace - collapsed);
    const middleTop = Math.max(0, sheetSpace - middle);

    return [
      collapsedTop,
      middleTop,
      // 확장이 기본보다 아래로 내려가면 단계 순서가 뒤집혀 드래그 범위가 깨진다.
      Math.min(expandedTop, middleTop - 1),
    ];
  }, [cardHeight, headerHeight, insets.top, sheetSpace]);
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

  /*
    측정값이 도착해 스냅 위치가 바뀌면 지금 단계에 맞춰 다시 놓는다.

    이게 없으면 시트가 첫 렌더의 어림값 자리에 그대로 머문다 — 단계는 "기본"인데 실제 높이는
    어림값이라 카드가 어중간하게 걸린다. 사용자가 한 번 끌어야 제자리를 찾게 된다.

    단계가 바뀐 것과 구분해야 한다. 단계 변경은 moveTo의 스프링이 맡으므로, 여기서 값을
    덮으면 그 애니메이션이 끊긴다. 그래서 스냅 배열 자체가 바뀐 경우에만 적용한다.
  */
  const appliedSnapPoints = useRef(snapPoints);
  useEffect(() => {
    if (appliedSnapPoints.current === snapPoints) return;
    appliedSnapPoints.current = snapPoints;

    // 보정이므로 애니메이션 없이 곧바로 놓는다. 사용자가 시작한 이동이 아니다.
    sheetY.setValue(snapPoints[level]);
    dragStart.current = snapPoints[level];
  }, [level, sheetY, snapPoints]);

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

  /**
   * 상세 화면으로 넘어간다. **고른 카드에 나타나는 `상세 보기` 버튼만** 이 역할을 한다.
   *
   * 카드를 누르는 것은 "저기가 어디인지 보고 싶다"에 가까워 지도 이동으로 답한다. 화면을
   * 전환하려면 한 번 고른 뒤 글자로 적힌 버튼을 눌러야 하므로, 지도를 보려던 탭이 화면
   * 전환으로 이어지는 일이 없다.
   */
  const openPlace = (placeId: string) => {
    selectPlace(placeId);
    router.push(`/place/${placeId}`);
  };

  /** 핀·카드 탭은 상세로 넘어가지 않고 해당 장소를 지도 중앙으로 부드럽게 옮긴다. */
  const focusPlace = useCallback(
    (placeId: string) => {
      const place = places.find((item) => item.id === placeId);
      if (!place) return;

      selectPlace(placeId);
      // 시트가 다 펼쳐져 있으면 내려서 지도를 보여준다. 이동 지시는 그 뒤로 미룬다(아래 참고).
      if (level === 2) moveTo(1);
      setPendingPan({ latitude: place.latitude, longitude: place.longitude });
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

  /*
    좌표를 기다리되 오래 붙잡지 않는다. 캐시된 위치가 있으면 즉시 오고, 없으면 새 측위가
    몇 초 걸릴 수 있다. 그동안 지도를 안 띄우면 로딩이 느려진 것으로 보이므로 한계를 둔다.
  */
  useEffect(() => {
    if (start) return;

    if (myLocation.coordinate) {
      setStart({ center: myLocation.coordinate, fromMyLocation: true });
      return;
    }

    const timer = setTimeout(
      () => setStart({ center: DEFAULT_CENTER, fromMyLocation: false }),
      MY_LOCATION_WAIT_MS,
    );
    return () => clearTimeout(timer);
  }, [myLocation.coordinate, start]);

  /*
    검색 화면에서 고른 장소로 이동한다.

    지도가 준비되기 전에 명령을 보내면 조용히 버려지므로 `mapReady`를 함께 본다.
    한 번 처리하면 비워서, 홈으로 돌아올 때마다 같은 곳으로 다시 끌려가지 않게 한다.
  */
  useEffect(() => {
    if (!mapReady || !focus) return;
    setPendingPan(focus.coordinate);
    clearFocus();
  }, [clearFocus, focus, mapReady]);

  // 밀린 이동을 실행한다. 이 시점의 coveredHeight는 시트의 최종 높이를 반영하고 있다.
  useEffect(() => {
    if (!mapReady || !pendingPan) return;
    mapRef.current?.panTo(pendingPan);
    setPendingPan(null);
  }, [mapReady, pendingPan]);

  /*
    화면이 다시 앞으로 나올 때 지도에 크기를 다시 알린다. 가려져 있는 동안 레이아웃이 바뀌면
    SDK가 모르고 있어 타일과 중심이 어긋난 채로 남는다.
  */
  useFocusEffect(
    useCallback(() => {
      mapRef.current?.relayout();
    }, []),
  );

  // 바텀시트가 가리는 높이. 지도 중심 이동 시 이만큼 보정해 보이는 영역의 중앙에 놓는다.
  const coveredHeight = Math.max(0, sheetSpace - snapPoints[level]);

  return (
    // 시트 스냅 계산의 기준 높이다. 창 높이가 아니라 이 영역의 높이를 써야 맞는다.
    <View style={s.screen} onLayout={(event) => setScreenHeight(event.nativeEvent.layout.height)}>
      {start ? (
        <KakaoMap
          ref={mapRef}
          fullScreen
          center={start.center}
          myLocation={myLocation.coordinate}
          bottomInset={coveredHeight}
          places={markers}
          filter={crowdFilter}
          selectedPlaceId={selectedPlaceId}
          // 내 위치에서 시작했으면 핀에 맞추지 않는다. 맞추면 그 중심을 곧바로 덮어쓴다.
          fitPlacesOnReady={!start.fromMyLocation}
          onReady={() => setMapReady(true)}
          onPinPress={focusPlace}
          onMapPress={clearSelection}
          onViewChange={handleViewChange}
        />
      ) : (
        // 좌표를 기다리는 짧은 구간. 지도 배경색 위에 표시만 둬 깜빡임을 줄인다.
        <View pointerEvents="none" style={s.mapPlaceholder}>
          <ActivityIndicator color={colors.gray600} />
        </View>
      )}

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
          accessibilityRole="button"
          accessibilityLabel="현재 위치로 돌아가기"
          accessibilityState={{ busy: myLocation.status === 'loading' }}
          disabled={myLocation.status === 'loading'}
          onPress={goToMyLocation}
          style={s.location}
        >
          {/*
            누른 뒤 아무 표시가 없으면 버튼이 고장난 것으로 보인다. 실제로 좌표를 받는 데
            몇 초가 걸릴 수 있어, 기다리는 중임을 반드시 드러낸다.
          */}
          {myLocation.status === 'loading' ? (
            <ActivityIndicator size="small" color={colors.dark} />
          ) : (
            <Ionicons
              name={myLocation.status === 'granted' ? 'locate' : 'locate-outline'}
              size={23}
              color={myLocation.status === 'denied' ? colors.gray400 : colors.dark}
            />
          )}
        </Pressable>

        {/* 실패 이유. 이게 없으면 권한 거부와 측위 실패가 똑같이 "아무 일도 안 남"으로 보인다. */}
        {myLocation.message && (
          <Text accessibilityRole="alert" style={s.locationMessage}>
            {myLocation.message}
          </Text>
        )}
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
            // 높이를 고정하지 않는다. 내용이 정하게 두어야 글자가 잘리지 않는다.
            onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}
            style={[s.handleArea, { paddingHorizontal: gutter }]}
          >
            <View style={s.handle} />
            <View style={s.sheetHeading}>
              {/*
                제목은 왼쪽, 토글은 오른쪽이다(와이어프레임). 예전에는 가운데로 모아 놓아
                좁은 화면에서 제목이 토글에 밀려 잘렸다. flex를 줘 남는 만큼 차지하게 한다.
              */}
              <Text numberOfLines={1} style={s.sheetTitle}>
                주위를 둘러볼까요?
              </Text>
              <CrowdFilterToggle value={crowdFilter} onChange={setCrowdFilter} />
            </View>
            {/* 지역명을 얻지 못하면 줄을 비운다. 틀린 지역을 적는 것보다 낫다. */}
            {myLocation.areaName && (
              <Text numberOfLines={1} style={s.sheetSubtitle}>
                현재 위치 : {myLocation.areaName}
              </Text>
            )}
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          scrollEnabled={level > 0}
          contentContainerStyle={[
            s.list,
            // 탭바는 이 영역 밖에 있어 마지막 카드를 가리지 않는다. 숨 쉴 여백만 둔다.
            { paddingHorizontal: gutter, paddingBottom: spacing.x6 },
          ]}
        >
          {visiblePlaces.map((place, index) => (
            <Pressable
              key={place.id}
              accessibilityRole="button"
              accessibilityLabel={`${place.name} 지도에서 보기`}
              accessibilityState={{ selected: place.id === selectedPlaceId }}
              onPress={() => focusPlace(place.id)}
              /*
                첫 카드만 재서 "기본" 단계 높이를 정한다. 카드 구조가 같아 하나로 충분하고,
                모두 재면 같은 값을 여러 번 쓰게 된다. 값이 실제로 바뀔 때만 반영해 되풀이를 막는다.
              */
              onLayout={
                index === 0
                  ? (event) => {
                      const measured = Math.round(event.nativeEvent.layout.height);
                      setCardHeight((current) => (current === measured ? current : measured));
                    }
                  : undefined
              }
              style={[s.placeCard, place.id === selectedPlaceId && s.placeCardSelected]}
            >
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
                {/*
                  고른 카드에만 상세로 가는 버튼을 글자로 띄운다.

                  예전에는 이 자리에 `>` 아이콘이 있었는데, 목록의 오른쪽 화살표는 "이 항목
                  열기"로 읽혀서 카드를 누르려는 손이 그쪽을 겨냥했다. 결국 지도만 옮기려는
                  탭이 화면 전환이 됐다. 글자로 적고 고른 뒤에만 보이면 헷갈릴 여지가 없다.
                */}
                {place.id === selectedPlaceId ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${place.name} 상세 보기`}
                    hitSlop={8}
                    onPress={() => openPlace(place.id)}
                    style={s.detailButton}
                  >
                    <Text style={s.detailButtonText}>상세 보기</Text>
                  </Pressable>
                ) : (
                  // 누르면 무엇이 일어나는지 알리는 표시. 화살표와 달리 이동을 약속하지 않는다.
                  <Ionicons name="location-outline" size={20} color={colors.gray400} />
                )}
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
  mapPlaceholder: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
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
  locationMessage: {
    ...type.caption,
    alignSelf: 'flex-end',
    marginTop: spacing.x2,
    paddingVertical: spacing.x1,
    paddingHorizontal: spacing.x3,
    borderRadius: radius.md,
    overflow: 'hidden',
    color: colors.white,
    backgroundColor: 'rgba(40,38,38,0.82)',
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
  handleArea: { paddingTop: spacing.x2, paddingBottom: spacing.x3 },
  handle: {
    width: 40,
    height: 4,
    alignSelf: 'center',
    borderRadius: radius.pill,
    backgroundColor: 'rgba(59,56,56,0.28)',
    marginBottom: spacing.x1,
  },
  sheetHeading: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.x3,
  },
  // flex로 남는 폭을 차지한다. 고정 폭이면 토글에 밀려 제목이 잘린다.
  sheetTitle: { ...type.body, flex: 1, fontSize: 17, lineHeight: 26, color: colors.dark, fontWeight: '600' },
  sheetSubtitle: { ...type.caption, color: colors.gray600, marginTop: spacing.x1 },
  list: { paddingTop: 0, gap: spacing.x3 },
  placeCard: {
    padding: spacing.x5,
    borderRadius: radius.card,
    backgroundColor: 'rgba(255,255,255,0.96)',
    ...glassShadow,
  },
  // 지도에서 보고 있는 장소를 목록에서도 알 수 있게 한다. 핀만 바뀌면 어느 카드였는지 놓친다.
  placeCardSelected: { borderWidth: 1.5, borderColor: colors.lime },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.x3 },
  detailButton: {
    minHeight: 34,
    paddingHorizontal: spacing.x3,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.gray100,
  },
  detailButtonText: { ...type.caption, color: colors.dark, fontWeight: '600' },
  placeCopy: { flex: 1, minWidth: 0 },
  // flex를 주면 안 된다. placeCopy가 세로 방향이라 제목이 남은 높이만큼 늘어나 줄이 어긋난다.
  placeName: { ...type.title, color: colors.dark },
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
