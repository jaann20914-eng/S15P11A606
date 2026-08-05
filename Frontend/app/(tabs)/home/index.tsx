import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { KakaoMap } from '@/components/home/KakaoMap';
import type { KakaoMapHandle } from '@/components/home/KakaoMap';
import type { MapViewState } from '@/components/home/kakaoMapHtml';
import { PLACE_FOCUS_MAP_LEVEL, REVIEW_PIN_MAX_LEVEL } from '@/components/home/kakaoMapHtml';
import {
  CARD_SLOT_GAP,
  CardPager,
  CrowdFilterToggle,
  useAppTabBarHeight,
  ViewAvatar,
} from '@/components/common';
import { NextPlaceButton, PLACE_PIN_CARD_HEIGHT } from '@/components/place';
import { DEFAULT_CENTER, useMapStore } from '@/store/useMapStore';
import type { Coordinate, MapBounds } from '@/store/useMapStore';
import { useScreenLayout } from '@/hooks/useResponsivePadding';
import { useCurrentLocation } from '@/hooks/useCurrentLocation';
import { useBottomSheet } from '@/hooks/useBottomSheet';
import { useFadeToggle } from '@/hooks/useFadeToggle';
import { useNextPlace } from '@/hooks/useNextPlace';
import { createDevLogger } from '@/utils/devLog';
import { distanceBetween } from '@/utils/location';
import { classifyCrowdFilter, matchesCrowdFilter } from '@/constants/crowdLevels';
import { usePlacesInView } from '@/features/home/hooks/usePlacesInView';
import { colors, layout, radius, spacing, type } from '@/constants/theme';

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
/*
  머리글 = 손잡이(8+4+4) + 제목 줄(44) + 현재 위치 줄(16-4) + 아래 여백(12) ≈ 84.
  예전 값(118)은 제목과 토글이 두 줄이던 때의 것이라, 켤 때마다 시트가 34px 높게 시작해
  측정이 도착하며 내려앉았다.
*/
const ESTIMATED_HEADER_HEIGHT = 84;
const ESTIMATED_CARD_HEIGHT = 208;

/**
 * 카드 자리의 **최소** 높이 = 핀 카드 한 장이 놓이는 칸.
 *
 * 장소 상세 시트의 "보통" 단계는 그 카드 한 장으로 높이가 잡힌다. 홈의 장소 카드는 썸네일이
 * 없어 그보다 39px 낮아서, **같은 자리에 있어야 할 두 시트가 47px 어긋나 보였다**
 * (2026-08-05 실기기 — 나머지 8px은 머리글 둘째 줄 여백이라 그쪽도 맞췄다).
 *
 * 카드 규격은 핀 쪽이 기준이다 — 썸네일 높이가 카드 높이를 정하고 그 값이 메모 줄 수까지
 * 정하므로 줄일 수 없다(`PLACE_PIN_CARD_HEIGHT`). 그래서 낮은 쪽인 홈이 이 값까지 자리를
 * 잡아 둔다. 장소를 열 때 시트가 뛰지 않는 것이 카드 아래 빈칸보다 낫다.
 *
 * 장소 카드가 이보다 커지면 잰 값을 쓴다 — 하한일 뿐이다.
 */
const MIN_CARD_SLOT_HEIGHT = PLACE_PIN_CARD_HEIGHT + CARD_SLOT_GAP;

/**
 * 카드가 없을 때 그 자리에 놓이는 안내 블록의 높이. **카드 한 칸과 같다.**
 *
 * 네 가지 안내(불러오는 중 · 실패 · 범위에 없음 · 필터에 걸림)가 모두 이 높이여야 한다. 다르면
 * 불러오는 중(표시 하나)과 결과 안내(두 줄) 사이에서 시트가 한 번 더 움직인다.
 *
 * **카드가 있는 상태와도 같아야 한다.** 예전에는 140이라, 혼잡도 토글을 눌러 걸리는 장소가
 * 없어지면 시트가 90px 낮아졌다 — 토글 하나로 시트가 오르내리는 셈이었다(2026-08-05 실기기).
 * 카드 칸과 같은 높이로 두면 어느 필터에서도, 카드가 있든 없든 시트가 제자리에 있다.
 */
const EMPTY_BLOCK_HEIGHT = MIN_CARD_SLOT_HEIGHT;

/**
 * 20m까지 당겼는데 핀이 올라온 장소가 없을 때 잠깐 띄우는 한 마디.
 *
 * 그 축척까지 당긴 것은 "이 자리를 들여다보겠다"는 뜻인데 보여줄 것이 없다. 없다고만 적으면
 * 막다른 길이라, **그 자리에서 할 수 있는 일**을 적는다 — 첫 핀을 남기는 것이다.
 */
const NO_PLACE_HINT = '이 장소에 핀을 올려보세요';

/** 한 마디가 머무는 시간(ms). 읽을 만하되 손을 막지 않는 길이다. */
const HINT_DURATION_MS = 1000;

/** 20m에 닿았을 때 무엇을 열었는지 터미널에서 따라갈 수 있게 한다. */
const log = createDevLogger('home-zoom');

/** 카드에 링으로 보여줄 작성자 수. 넘치는 핀은 `+n`으로 적는다. */
const ANGLE_PREVIEW_COUNT = 5;

/**
 * 그 장소가 지금 화면 안에 있는지.
 *
 * 목록은 지도에 보이는 범위보다 넓게 받아 두므로(`usePlacesInView`의 첫 조회는 ±11km) 담긴 것만
 * 골라야 한다. 경계를 아직 모르면(첫 프레임) 걸러 낼 근거가 없어 전부 담긴 것으로 본다.
 */
function withinBounds(place: Coordinate, bounds: MapBounds | null): boolean {
  if (bounds === null) return true;

  const { southWest, northEast } = bounds;
  return (
    place.latitude >= southWest.latitude &&
    place.latitude <= northEast.latitude &&
    place.longitude >= southWest.longitude &&
    place.longitude <= northEast.longitude
  );
}

/** 카드의 각도 링 지름. */
const ANGLE_RING_SIZE = 34;

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
  const pinOverlay = useMapStore((state) => state.pinOverlay);
  /**
   * 눌린 핀을 상세에 알리는 통로. 마커는 홈이 그리고 알림도 홈으로 오기 때문이다.
   *
   * **한 번 쓰고 비우는 요청이다.** 겹의 `selectedPinId`를 고치는 것이 아니다 — 그 칸을 두 쪽이
   * 함께 쓰면 서로의 낡은 값으로 되돌리기를 주고받는다(`pressedPinId` 설명).
   */
  const pressPin = useMapStore((state) => state.pressPin);
  const setGestureControl = useMapStore((state) => state.setGestureControl);
  /** 20m에서 돌려 볼 장소들. 이 화면이 채우고 옆 장소 버튼이 읽는다. */
  const nearbyPlaces = useMapStore((state) => state.nearbyPlaces);
  const setNearbyPlaces = useMapStore((state) => state.setNearbyPlaces);
  const [mapReady, setMapReady] = useState(false);

  /** 잠깐 띄우는 한 마디. 없으면 null. */
  const [hint, setHint] = useState<string | null>(null);

  /**
   * 이 화면이 맨 위인지.
   *
   * 장소 상세는 반투명 모달로 **홈 위에 겹친다.** 그때 홈 시트를 그대로 두면 두 시트가
   * 반투명하게 서로 비쳐 글자가 겹쳐 읽힌다. 위에 무언가 올라오면 홈 시트를 감춘다.
   *
   * 감추기만 하고 언마운트하지 않는다 — 스크롤 위치와 재측정을 잃지 않아야 상세를 닫았을 때
   * 있던 자리로 정확히 돌아온다.
   *
   * **지도 마커를 눌렀을 때 화면을 바꿀지도 이 값으로 가른다**(`pressMapPin`).
   */
  const [onTop, setOnTop] = useState(true);

  /**
   * 지도를 시작할 지점. 정해지기 전에는 지도를 띄우지 않는다.
   *
   * `KakaoMap`은 최초 중심을 첫 렌더에 HTML로 심으므로, 나중에 옮기면 엉뚱한 동네 타일을
   * 받아 놓고 버리게 된다. 그래서 좌표를 먼저 기다린다.
   *
   * 내 위치를 얻었으면 그 자리에서, 못 얻었으면 기본 중심에서 시작한다. 어느 쪽이든 준비된
   * 뒤에 핀 전체가 담기도록 맞춘다(`fitPlacesOnReady` 참고) — 그래야 첫 화면이 비지 않는다.
   */
  const [start, setStart] = useState<Coordinate | null>(null);

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
  const [pendingPan, setPendingPan] = useState<{ coordinate: Coordinate; level: number } | null>(null);
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
  /** 카드가 없을 때 그 자리를 채우는 안내 블록의 높이. 그 상태의 "보통" 단계 높이가 된다. */
  const [emptyHeight, setEmptyHeight] = useState(0);

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

  /*
    잰 값을 위에 겹치는 장소 상세에도 나눠 준다.

    그 화면은 탭 그룹 밖이라 자기가 잴 수 있는 것이 창 높이뿐이고, 거기서 탭바를 빼도 이 값과
    같지 않았다 — 실기기에서 상세 시트가 홈보다 눈에 띄게 높았던 이유다. 재는 쪽 값을 그대로
    쓰면 두 시트가 같은 자리에 놓인다.
  */
  const setHomeSheetSpace = useMapStore((state) => state.setHomeSheetSpace);
  useEffect(() => {
    if (screenHeight > 0) setHomeSheetSpace(screenHeight);
  }, [screenHeight, setHomeSheetSpace]);

  /*
    지도에 찍을 장소. **지도에 보이는 범위를 서버에 물어 받는다**(`GET /api/v1/places`).

    예전에는 손으로 박아 둔 배열(`@/data/mock`)을 직접 읽었다. 목업 모드에서는 그럴듯하게
    보였지만 실서버로 돌리면 **없는 장소 세 곳이 지도에 남고, 그 id로 상세를 열어 404가 났다.**
    목업/실서버 판정은 API 경계 한 곳(`api/place/list.ts`)이 하므로 이 화면은 어느 쪽인지 모른다.

    응답의 좌표는 훅이 함께 기억해 둔다 — 장소 상세와 핀 카드에는 좌표가 없어서, 상세 화면이
    핀을 지도에 찍으려면 이 응답이 유일한 출처다.
  */
  const bounds = useMapStore((state) => state.bounds);
  const inView = usePlacesInView(bounds);

  /*
    혼잡도 필터로 거른다. **평균 혼잡도가 없는 장소는 어느 필터에도 들지 않는다** — 최근 1시간에
    올라온 핀이 없어 여유인지 와글인지 판단할 근거가 없다. 서버 필터도 같은 규칙이다
    (`PlacePinService.matchesFilter`가 `null`을 탈락시킨다).
  */
  const visiblePlaces = useMemo(
    () =>
      inView.places.filter(
        (place) => place.crowdLevel !== null && matchesCrowdFilter(place.crowdLevel, crowdFilter),
      ),
    [crowdFilter, inView.places],
  );

  /*
    보여줄 카드가 없는 상태인지. **시트의 "보통" 단계 높이가 이 값으로 갈린다** — 카드가 있으면
    카드 한 장, 없으면 그 자리에 놓이는 안내 블록에 맞춘다. 그래서 시트 계산보다 먼저 구한다.
  */
  const listEmpty = visiblePlaces.length === 0;

  /*
    3단계 높이를 정하는 값. 시트 움직임 자체는 useBottomSheet이 맡는다.

    - 축소 — 헤더만. 탭바는 이 영역 밖에 있으므로 더 보탤 것이 없다.
    - 기본 — 헤더 + 카드 하나. 카드 아래로 약간 여백을 둬 잘려 보이지 않게 한다.
    - 확장 — 검색바 바로 아래. 검색바는 `insets.top + spacing.x3`에서 시작해
      `layout.searchHeight`만큼 차지하므로 그 끝에서 한 칸 띄운 자리가 상한이다.
  */
  const sheet = useBottomSheet({
    space: sheetSpace,
    collapsed: headerHeight > 0 ? headerHeight : ESTIMATED_HEADER_HEIGHT,
    /*
      **비어 있으면 안내 블록에 맞춘다.**

      예전에는 늘 카드 높이로 잡았다. 그런데 카드가 없을 때 그 자리에 놓이는 것은 카드가 아니라
      안내 문구라, 있지도 않은 카드 높이로 시트를 벌려 안내 아래에 빈 칸이 한참 남았다. 켤 때마다
      크기가 달라 보인 것도 그래서다 — 카드를 한 번도 재지 못했으면 어림값이, 필터를 바꿔 비었으면
      직전에 잰 카드 높이가 그대로 쓰였다.
    */
    middleExtra:
      (listEmpty
        ? emptyHeight > 0
          ? emptyHeight
          : EMPTY_BLOCK_HEIGHT
        : // 카드가 있으면 최소한 핀 카드 한 장 자리는 잡는다(위 설명).
          Math.max(cardHeight > 0 ? cardHeight : ESTIMATED_CARD_HEIGHT, MIN_CARD_SLOT_HEIGHT)) + spacing.x4,
    expandedTop: insets.top + spacing.x3 + layout.searchHeight + spacing.x4,
  });
  const { level, moveTo, sheetY, coveredHeight } = sheet;

  /**
   * 지금 지도 축척(카카오 레벨). 작을수록 당겨진 상태다.
   *
   * **저장소에 둔다.** 20m에서만 있는 컨트롤(옆 장소 버튼)이 위에 겹치는 장소 상세에도 떠야
   * 하는데, 그 화면은 자기 지도가 없어 축척을 알 길이 없다.
   */
  const mapLevel = useMapStore((state) => state.mapLevel);
  const setMapLevel = useMapStore((state) => state.setMapLevel);

  /*
    지도에 찍을 마커.

    **상세 화면이 열려 있으면 그쪽 핀을 찍는다.** 상세는 자기 지도가 없어 이 지도를
    반투명하게 비추고 있을 뿐이므로, 핀 마커도 여기서 그려야 한다(`pinOverlay`).
    상세를 닫으면 비워지고 장소 마커로 돌아온다.
  */
  const placeMarkers = useMemo(
    () =>
      visiblePlaces.map(({ id, name, latitude, longitude, crowdLevel }) => ({
        id,
        name,
        latitude,
        longitude,
        /*
          **색은 그 장소의 평균 혼잡도가 정한다.** 토글을 넘기지 않는다.

          걸러진 목록이라 지금은 두 값이 같지만, 색의 근거를 필터에 두면 걸러지지 않는 마커가
          생기는 순간 거짓이 된다 — 장소 상세의 핀이 그랬다. 여기서도 값을 실어 보낸다.
        */
        tone: classifyCrowdFilter(crowdLevel) ?? undefined,
      })),
    [visiblePlaces],
  );
  const markers = pinOverlay ? pinOverlay.markers : placeMarkers;
  const selectedMarkerId = pinOverlay ? pinOverlay.selectedPinId : selectedPlaceId;

  /**
   * 고른 장소가 목록에서 몇 번째인지. 한 장씩 넘기는 칸이 그 카드를 보여주도록 넘긴다.
   *
   * 지도 핀을 누르거나, 확장 목록에서 카드를 눌러 "보통" 단계로 내려올 때가 이 경우다. 이게
   * 없으면 방금 고른 장소에 테두리는 쳐지는데 화면에는 첫 카드가 보인다.
   *
   * 걸러진 목록에 없으면 `-1`이고, 그때는 칸이 그대로 있는다(`CardPager`가 무시한다).
   */
  const selectedCardIndex = useMemo(
    () => visiblePlaces.findIndex((place) => place.id === selectedPlaceId),
    [selectedPlaceId, visiblePlaces],
  );

  /**
   * 카드를 넘겼을 때. **보고 있는 카드의 장소를 고른 것으로 다룬다.**
   *
   * 지도 마커가 그 장소에서 물방울로 바뀌어, 지금 어느 카드를 보고 있는지 지도에서도 읽힌다.
   * 장소 상세가 게시물 카드를 넘길 때 하는 것과 같다(그쪽은 `onIndexChange`로 핀을 고른다) —
   * 같은 칸(`CardPager`)을 쓰는데 홈만 이 통로를 연결하지 않아 마커가 첫 장소에 머물렀다.
   *
   * **지도는 옮기지 않는다.** 넘기는 것은 목록을 훑는 동작이고, 그 장소로 가겠다는 뜻은 카드를
   * 누르는 것이다(`focusPlace`). 넘길 때마다 지도가 따라 움직이면 훑는 중에 보고 있던 자리를
   * 잃는다 — 혼잡도 토글에서 `fitPlaces`를 걷어낸 것과 같은 이유다.
   */
  const selectCardAt = useCallback(
    (index: number) => {
      const place = visiblePlaces[index];
      if (place) selectPlace(place.id);
    },
    [selectPlace, visiblePlaces],
  );

  /**
   * 상세 화면으로 넘어간다. **고른 카드의 꺽새만** 이 역할을 한다.
   *
   * 카드를 누르는 것은 "저기가 어디인지 보고 싶다"에 가까워 지도 이동으로 답한다. 화면을
   * 전환하려면 한 번 고른 뒤 꺽새를 눌러야 하므로, 지도를 보려던 탭이 화면 전환으로
   * 이어지는 일이 없다.
   *
   * **넘어가면서 그 장소를 핀 축척까지 당긴다.** 상세는 자기 지도가 없어 이 지도를 그대로
   * 비추므로, 화면이 바뀌는 동안 지도가 손으로 벌린 것처럼 이어서 당겨진다(지도 쪽에서 한
   * 단계씩 이어 붙인다 — `zoomStepwise`). 예전에는 상세가 열려 핀을 받은 뒤에야 당기기
   * 시작해서, 시트만 툭 덮이고 지도는 한참 뒤에 따로 움직였다.
   *
   * 핀 목록이 도착하면 상세가 첫 게시물의 핀으로 중심만 다시 맞춘다. 이미 같은 축척이라
   * 그때는 짧게 미끄러질 뿐이다.
   */
  const openPlace = useCallback(
    (placeId: string) => {
      const place = inView.places.find((item) => item.id === placeId);
      if (place) {
        /*
          **먼저 시트를 "보통"으로 내린다.** 지도를 얼마나 위로 밀어 둘지는 이 시트가 가리는
          높이로 정하는데(`bottomInset` → `focusPlace`), 목록까지 펼친 상태에서 넘어가면 그
          펼친 높이만큼 밀어 놓고 상세는 "보통" 높이로 열려 **장소가 화면 위쪽으로 치우쳤다**
          (2026-08-05). 상세 시트의 "보통" 단계는 홈의 그 단계와 같은 높이로 맞춰 두었으므로
          (`homeSheetSpace`), 여기서 단계를 맞춰 두면 두 화면이 같은 자리를 가리킨다.

          **어느 단계에서 왔든 맞춘다.** 상세는 늘 "보통"으로 열리므로 축소에서 넘어가도
          어긋난다 — 그때는 가림 높이가 작아 장소가 중앙보다 아래에 놓인다(20m에서 마커를 눌러
          바로 들어오는 경로가 그렇다).

          움직이는 것은 화면 전환에 가려 보이지 않는다. 돌아오면 홈이 "보통"으로 있는데, 장소를
          보러 목록을 떠난 흐름이라 그 자리가 자연스럽다.

          카드를 눌러 지도만 옮길 때도 같은 것을 한다(`focusPlace`) — 이동 지시를 이 렌더에
          함께 넣어야 실행 시점의 가림 높이가 최종 높이가 된다(아래 `pendingPan` 참고).
        */
        if (level !== 1) moveTo(1);
        setPendingPan({
          coordinate: { latitude: place.latitude, longitude: place.longitude },
          level: REVIEW_PIN_MAX_LEVEL,
        });
      }

      /*
        **고른 것으로 표시해 둔다.** 카드 꺽새로 들어오는 길은 이미 골라져 있지만, 20m까지 당겨
        저절로 열리는 길과 옆 장소로 돌려 보는 길은 여기서만 정해진다 — 그 값이 "지금 어디"의
        기준이라(`useNextPlace`) 비어 있으면 돌려 보기가 늘 첫 장소에서 다시 시작한다.
      */
      selectPlace(placeId);
      router.push(`/place/${placeId}`);
    },
    [inView.places, level, moveTo, selectPlace],
  );

  /**
   * 카드나 지도 핀을 눌렀을 때. 상세로 넘어가지 않고 그 장소를 보여주기만 한다.
   *
   * 멀리서 보고 있었으면 250m까지 당기고, 화면 밖이면 손으로 쓸어가듯 중앙으로 데려온다.
   * 이미 그보다 가까이 당겨 둔 상태라면 축척은 그대로 둔다 — 판정은 지도 쪽 `focusPlace`가
   * 한다. 이 화면은 어디로 갈지만 정하고, 얼마나 당길지는 지도가 정한다.
   */
  const focusPlace = useCallback(
    (placeId: string) => {
      /*
        걸러진 목록이 아니라 **받아 둔 전부**에서 찾는다. 필터를 바꾸는 순간에도 방금 누른 마커의
        좌표를 알 수 있어야 한다.
      */
      const place = inView.places.find((item) => item.id === placeId);
      if (!place) return;

      selectPlace(placeId);
      // 시트가 다 펼쳐져 있으면 내려서 지도를 보여준다. 이동 지시는 그 뒤로 미룬다(아래 참고).
      if (level === 2) moveTo(1);
      setPendingPan({
        coordinate: { latitude: place.latitude, longitude: place.longitude },
        level: PLACE_FOCUS_MAP_LEVEL,
      });
    },
    [level, moveTo, inView.places, selectPlace],
  );

  /**
   * 지도 마커를 눌렀을 때.
   *
   * 축척을 20m까지 당긴 상태에서는 마커가 **리뷰핀**이다. 그때는 지도만 옮기지 않고 그 장소의
   * 상세까지 연다 — 그만큼 당겼으면 누른 것이 어느 곳인지 확실하기 때문이다.
   *
   * 그보다 넓게 보고 있으면 지금처럼 지도만 옮긴다. 손가락 하나에 여러 장소가 걸리는 축척에서
   * 화면까지 바뀌면 실수가 된다. 목록 카드를 누르는 것도 지도 이동까지만인 것과 같은 이유다.
   */
  const pressMapPin = useCallback(
    (placeId: string) => {
      /*
        **핀 마커였으면 그 핀을 고른 것으로 상세에 넘긴다.**

        이 지도는 장소 마커만 찍는 것이 아니다. 장소 상세가 열려 있는 동안에는 그쪽 핀을
        대신 그리고(`pinOverlay`), 그때 눌린 id는 우리 `placeId`가 아니라 `pinId`(UUID)다.
        상세로 넘기면 `/place/<UUID>`가 되어 "장소를 찾을 수 없어요"가 열린다.

        그래서 눌린 것이 지금 올려 둔 핀 중 하나면 **고른 핀만 바꿔** 되돌려 준다. 상세가 그
        값을 보고 해당 카드로 넘어가고(마커도 물방울로 바뀐다), 지도를 그 핀 자리로 옮긴다 —
        홈에서 장소 마커를 눌렀을 때 그 카드가 골라지는 것과 같은 동작이다.

        고른 핀을 정하는 일이 왜 홈을 거치는지: 지도는 홈 것이고 마커 알림도 홈으로 온다. 상세는
        자기 지도가 없어 이 통로 말고는 눌린 것을 알 방법이 없다.
      */
      if (pinOverlay !== null) {
        const pressedPin = pinOverlay.markers.some((marker) => marker.id === placeId);
        /*
          **겹의 값을 고쳐서 알리지 않는다.** 그 칸(`selectedPinId`)은 상세 화면이 "보고 있는
          카드"를 쓰는 자리다. 여기서 같은 칸에 "눌린 마커"를 써 넣으면 두 쪽이 서로의 **한 커밋
          지난 값**을 보고 되돌리기를 주고받아 카드가 튀다 렌더가 끊긴다(`pressedPinId` 설명).

          그래서 눌림만 따로 한 번 알린다. 받은 화면이 카드를 맞추고 곧바로 비운다.
        */
        if (pressedPin) pressPin(placeId);
        return;
      }

      // 받아 둔 장소가 아니면 아무것도 하지 않는다. 경계에서 한 번 걸러 두면 조용히 깨지지 않는다.
      const known = inView.places.some((place) => place.id === placeId);
      if (!known) return;

      focusPlace(placeId);

      /*
        **위에 다른 화면이 있으면 새 화면을 열지 않는다.**

        이 알림은 홈이 눌린 것이 아니라 **위에 겹친 화면이 넘긴 탭**일 수 있다(`tapAt`) —
        그 화면들은 지도가 없어 손가락을 받아 이 지도로 보내기 때문이다. 그때 여기서 상세를
        열면 **이미 열려 있는 그 화면 위에 같은 화면이 한 겹 더 쌓인다.** 쌓일 때마다 장소를
        다시 조회하고 카드 수만큼 썸네일을 다시 받으므로, 몇 번만 눌려도 화면과 요청이 불어난다.

        핀 겹이 올라와 있으면 위에서 이미 돌아갔으므로, 여기 오는 것은 겹이 없는 경우다 —
        상세가 좌표를 못 받아 마커를 하나도 올리지 못한 장소가 그렇다.
      */
      if (!onTop) return;

      if (mapLevel <= REVIEW_PIN_MAX_LEVEL) openPlace(placeId);
    },
    [focusPlace, inView.places, mapLevel, onTop, openPlace, pinOverlay, pressPin],
  );

  const handleViewChange = useCallback(
    (view: MapViewState) => {
      // 마커를 리뷰핀으로 다룰지 판단하는 값이다. 지도가 멈출 때마다 갱신된다.
      setMapLevel(view.level);
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
      setStart(myLocation.coordinate);
      return;
    }

    const timer = setTimeout(() => setStart(DEFAULT_CENTER), MY_LOCATION_WAIT_MS);
    return () => clearTimeout(timer);
  }, [myLocation.coordinate, start]);

  /*
    검색 화면에서 고른 장소로 이동한다.

    지도가 준비되기 전에 명령을 보내면 조용히 버려지므로 `mapReady`를 함께 본다.
    한 번 처리하면 비워서, 홈으로 돌아올 때마다 같은 곳으로 다시 끌려가지 않게 한다.
  */
  useEffect(() => {
    if (!mapReady || !focus) return;
    // 핀은 20m까지 당겨야 여러 개가 겹치지 않는다. 부르는 쪽이 정한 축척을 따른다.
    setPendingPan({ coordinate: focus.coordinate, level: focus.level ?? PLACE_FOCUS_MAP_LEVEL });
    clearFocus();
  }, [clearFocus, focus, mapReady]);

  /*
    밀린 이동을 실행한다. 이 시점의 coveredHeight는 시트의 최종 높이를 반영하고 있다.

    `panTo`가 아니라 `focusPlace`를 쓴다. 옮기면서 필요한 만큼 당기는 것까지 지도가 한 번에
    맡는다 — 여기서 두 명령을 잇달아 보내면 확대가 이동을 끊거나, 끝나면서 방금 옮긴 중심을
    되돌린다. 이미 250m보다 가까이 보고 있으면 지도가 축척을 그대로 둔다.
  */
  useEffect(() => {
    if (!mapReady || !pendingPan) return;
    mapRef.current?.focusPlace(pendingPan.coordinate, pendingPan.level);
    setPendingPan(null);
  }, [mapReady, pendingPan]);

  /*
    **사용자가 직접 20m까지 당기면 그 자리의 장소를 열어 준다.**

    그 축척은 카카오가 주는 가장 가까운 눈금이라, 거기까지 당긴 것은 "이 장소를 들여다보겠다"는
    뜻으로 읽는다. 그래서 가장 가까운 장소의 상세를 띄우고, 화면에 담긴 나머지 장소는 돌려 볼
    목록으로 저장소에 올려 둔다(`nearbyPlaces` → 옆 장소 버튼).

    **당긴 그 순간에만 한다.** 20m에 머무는 동안 지도를 밀 때마다 다시 열면 손이 지도를 놓지
    못한다. 직전 축척을 들고 있다가 20m로 **넘어오는 순간**만 잡는다.

    **맨 위일 때만 한다.** 상세가 이미 열려 있으면 그쪽이 지도를 20m로 쓰고 있으므로 우리 차례가
    아니다. 이 조건이 우리가 스스로 당기는 경우(카드 꺽새·검색 확정·마커 탭)도 함께 걸러 준다 —
    그 길들은 같은 tick에 상세를 띄우므로, 확대가 끝나 축척이 도착할 때는 맨 위가 아니다.
  */
  const previousMapLevel = useRef(mapLevel);
  /**
   * 지금 열려 있는 상세를 **축척 때문에 우리가 열었는지.**
   *
   * 그렇다면 축척이 그 자리를 벗어날 때 우리가 접는다(아래). 사용자가 카드 꺽새나 검색으로 직접
   * 연 상세는 건드리지 않는다 — 그 화면은 축척과 무관하게 보러 들어온 것이다.
   */
  const openedByZoom = useRef(false);
  /**
   * 축척을 넓혀서 그 상세를 접었는지.
   *
   * 상세가 닫히면 홈은 장소용 축척(250m)으로 넓히지만, 손으로 넓혀서 닫힌 경우에는 사용자가
   * 이미 축척을 정한 것이라 그대로 둬야 한다(아래 `hadPinOverlay` 효과에서 소비한다).
   */
  const closedByZoom = useRef(false);

  useEffect(() => {
    const from = previousMapLevel.current;
    previousMapLevel.current = mapLevel;

    /*
      **그 축척을 벗어나면 상세도 접는다.**

      20m는 장소 하나를 들여다보는 축척이고, 넓히는 것은 다시 둘러보겠다는 뜻이다. 그런데 상세는
      열린 채로 남아 **지도를 쓰는 값을 다 끌고 다녔다** — 핀 마커와 썸네일을 그대로 들고 있고,
      무엇보다 그 화면은 자기 지도가 없어 **손가락 움직임 하나하나를 명령으로 바꿔** 아래 지도에
      보낸다(`useMapGestures` → `dragBy`). 홈에서는 손가락이 WebView에 곧바로 닿는데 그 경로는
      프레임마다 스크립트를 주입하므로, 상세를 열어 둔 채 지도를 다루면 눈에 띄게 버벅였다
      (2026-08-05 실기기). 접어 두면 그 뒤의 지도 조작은 다시 홈의 빠른 길로 돌아간다.

      우리가 연 것만 접는다. 그리고 목록도 함께 버려 버튼이 사라진다.
    */
    if (mapLevel > REVIEW_PIN_MAX_LEVEL) {
      if (nearbyPlaces.length > 0) setNearbyPlaces([]);

      if (openedByZoom.current) {
        openedByZoom.current = false;
        /*
          맨 위가 아닐 때만 접는다 — 맨 위면 이미 접힌 것이다. 우리가 연 상세 위에 사용자가 또
          다른 화면을 얹었을 가능성은 두지 않는다: 그 화면들에는 지도가 없어 축척이 바뀌지 않고,
          홈이 다시 맨 위가 되는 순간 이 표시를 지우기 때문이다(`useFocusEffect`).
        */
        if (!onTop && router.canGoBack()) {
          log('20m 벗어남 — 상세를 접는다', { 축척: mapLevel });
          // 닫힌 뒤 축척을 다시 넓히지 않도록 알려 둔다. 손이 정한 축척이 그대로 남아야 한다.
          closedByZoom.current = true;
          router.back();
        }
      }
      return;
    }

    if (!onTop || from <= REVIEW_PIN_MAX_LEVEL) return;

    /*
      화면에 담긴, 핀이 올라온 장소들. **사용자에게 가까운 순**이다.

      보이는 마커와 같은 목록을 쓴다(`visiblePlaces` — 혼잡도 토글이 걸러 낸 것). 지도에 없는
      장소로 넘어가면 버튼이 어디로 데려간 것인지 알 수 없다.

      기준점은 내 위치이고, 없으면 지도 중심이다 — 권한을 주지 않은 사용자에게도 "가까운 순"이
      성립해야 한다. 화면 밖은 뺀다: 당긴 화면에 담긴 것만 돌려 본다.
    */
    // 지도 중심은 여기서만 필요하다. 구독하면 지도가 멈출 때마다 이 화면이 다시 그려진다.
    const origin = myLocation.coordinate ?? useMapStore.getState().center;
    const found = visiblePlaces
      .filter((place) => withinBounds(place, bounds))
      .map((place) => ({
        marker: { id: place.id, name: place.name, latitude: place.latitude, longitude: place.longitude },
        distance: distanceBetween(origin, place),
      }))
      .sort((left, right) => left.distance - right.distance)
      .map((item) => item.marker);

    setNearbyPlaces(found);
    log('20m 도달', {
      직전축척: from,
      돌려볼장소: found.map((place) => place.name),
      기준점: myLocation.coordinate ? '내 위치' : '지도 중심',
    });

    /*
      한 곳도 없으면 열 상세가 없다. **그 자리를 채우라고 한 마디 띄운다** — 잠깐 뜨고 사라지므로
      손을 막지 않고, 20m까지 당긴 사용자가 다음에 할 수 있는 일이 그것뿐이다.
    */
    if (found.length === 0) {
      setHint(NO_PLACE_HINT);
      return;
    }

    // 우리가 여는 것이므로 표시해 둔다. 축척이 그 자리를 벗어나면 우리가 접는다.
    openedByZoom.current = true;
    openPlace(found[0].id);
  }, [
    bounds,
    mapLevel,
    myLocation.coordinate,
    nearbyPlaces.length,
    onTop,
    openPlace,
    setNearbyPlaces,
    visiblePlaces,
  ]);

  /* 한 마디는 잠깐 있다 사라진다. 새 안내가 들어오면 그때부터 다시 센다. */
  useEffect(() => {
    if (hint === null) return;

    const timer = setTimeout(() => setHint(null), HINT_DURATION_MS);
    return () => clearTimeout(timer);
  }, [hint]);

  /*
    상세를 닫으면 장소 마커가 다시 **여러 개** 보이는 축척으로 넓힌다.

    상세는 핀을 20m까지 당겨 보여준다. 그 상태로 홈에 돌아오면 마커는 장소로 되돌아오지만
    그 축척에는 장소 하나밖에 들어오지 않아, 핀이 하나뿐인 지도가 기본 화면으로 남는다.
    장소용 축척(250m)으로 넓혀 주변 장소가 함께 보이게 한다.

    이미 그보다 넓게 보고 있으면 건드리지 않는다 — 사용자가 손으로 잡은 축척을 되돌리지 않는다.

    **축척을 넓혀서 닫힌 경우에는 그대로 둔다.** 20m를 벗어나면 우리가 상세를 접는데(위), 그때는
    사용자가 이미 손으로 축척을 정한 것이다. 여기서 또 넓히면 한 단계 벌린 손짓이 250m로 뛰어
    엉뚱한 동네가 나온다.
  */
  const hadPinOverlay = useRef(false);
  useEffect(() => {
    if (pinOverlay !== null) {
      hadPinOverlay.current = true;
      return;
    }
    if (!hadPinOverlay.current) return;

    /*
      **겹이 비는 순간이 곧 상세가 닫힌 것은 아니다.**

      화면이 갈릴 때도 잠깐 빈다. 그때 넓히면 20m를 벗어나 방금 연 상세가 접히고, 다시 20m로
      돌아와 첫 장소가 열린다 — 옆 장소 버튼 한 번에 홈을 거쳐 한 바퀴 도는 것으로 보였다
      (2026-08-05 실기기). 돌려 보기는 이제 화면을 갈아 끼우지 않지만, 판단의 근거를 "겹이
      비었다"에서 **"홈이 실제로 맨 위로 돌아왔다"**로 옮겨 둔다.

      표시는 그때까지 남겨 둔다 — 늦게 돌아와도 넓히는 일을 놓치지 않는다.
    */
    if (!onTop) return;

    hadPinOverlay.current = false;

    if (closedByZoom.current) {
      closedByZoom.current = false;
      return;
    }

    if (mapLevel < PLACE_FOCUS_MAP_LEVEL) mapRef.current?.setLevel(PLACE_FOCUS_MAP_LEVEL);
  }, [mapLevel, onTop, pinOverlay]);

  /* 홈이 사라지면 이 지도도 없다. 손잡이를 남겨 두면 없는 WebView에 명령을 보낸다. */
  useEffect(() => () => setGestureControl(null), [setGestureControl]);

  /*
    맨 위인지 여부(`onTop`)는 위에서 선언한다 — 지도 마커 처리(`pressMapPin`)가 그 값을 본다.

    다시 앞으로 나올 때 지도에 크기를 다시 알린다. 가려져 있는 동안 레이아웃이 바뀌면
    SDK가 모르고 있어 타일과 중심이 어긋난 채로 남는다.
  */
  useFocusEffect(
    useCallback(() => {
      setOnTop(true);
      /*
        맨 위로 돌아왔다는 것은 우리가 열어 둔 상세가 이미 닫혔다는 뜻이다. 표시를 지워야 다음
        축척 변화에서 엉뚱한 화면을 접지 않는다(`openedByZoom` 설명).
      */
      openedByZoom.current = false;
      mapRef.current?.relayout();
      return () => setOnTop(false);
    }, []),
  );

  /**
   * 내 위치 버튼을 보일지.
   *
   * 두 가지 경우에 감춘다.
   * - **최대화 단계**: 시트가 검색바 바로 아래까지 올라와 버튼과 겹친다.
   * - **위에 장소 상세가 올라왔을 때**: 상세는 반투명 모달이라 이 화면이 그대로 살아 있다.
   *   상세도 같은 자리에 자기 버튼을 그리므로, 감추지 않으면 두 버튼이 겹쳐 있고 상세가
   *   최대화되어 자기 버튼을 감춰도 **이 버튼이 상세 시트 뒤에 남아 그대로 보인다.**
   *   상세 화면에서 버튼이 사라지지 않은 이유가 이것이었다. 시트를 감추는 것과 같은 조건이다.
   */
  const locationButton = useFadeToggle(onTop && level !== 2);

  /**
   * 옆 장소로 돌려 보기. **20m까지 당겨 화면에 두 곳 이상이 담겼을 때만** 버튼이 있다.
   *
   * 이 화면에서는 상세를 처음 여는 것이라 화면을 쌓는다(장소 상세에서 누를 때는 갈아 끼운다).
   * 내 위치 버튼과 같은 조건으로 함께 감춘다 — 최대화 단계에서는 시트가 그 자리를 덮는다.
   */
  const nextPlace = useNextPlace();
  const nextPlaceButton = useFadeToggle(nextPlace.visible && onTop && level !== 2);

  /** 잠깐 뜨는 한 마디의 나타남·사라짐. 조건을 그대로 걸면 1초짜리 안내가 깜빡임으로 읽힌다. */
  const hintToggle = useFadeToggle(hint !== null);

  return (
    // 시트 스냅 계산의 기준 높이다. 창 높이가 아니라 이 영역의 높이를 써야 맞는다.
    <View style={s.screen} onLayout={(event) => setScreenHeight(event.nativeEvent.layout.height)}>
      {start ? (
        <KakaoMap
          ref={mapRef}
          fullScreen
          center={start}
          myLocation={myLocation.coordinate}
          bottomInset={coveredHeight}
          places={markers}
          filter={crowdFilter}
          selectedPlaceId={selectedMarkerId}
          /*
            **첫 화면은 언제나 핀 전체가 담기도록 맞춘다.**

            예전에는 내 위치를 얻었으면 맞추지 않았다(`!start.fromMyLocation`) — 방금 잡은 중심을
            덮어쓰지 않으려는 것이었다. 그런데 장소들은 성수·광진 일대에 모여 있어서, 그 밖에서
            앱을 열면 **핀이 하나도 없는 지도**가 기본 화면이 됐다. 실기기에서 강남에서 열었을 때
            바로 그랬다. 지도에 아무것도 없으면 "핀이 안 나온다"가 되고, 그게 첫 화면이다.

            내 위치는 마커로 그대로 남고 버튼 한 번으로 돌아갈 수 있다. 반대로 핀이 화면 밖에
            있으면 그것을 되찾을 방법이 사용자에게 없다.
          */
          fitPlacesOnReady
          onReady={() => {
            setMapReady(true);
            /*
              지도 손잡이를 저장소에 등록한다.

              **위에 겹치는 장소 상세가 이것으로 이 지도를 끌고 당긴다.** 그 화면은 자기 지도가
              없고, 안드로이드에서는 겹친 화면이 터치를 삼켜 손가락이 이 WebView까지 닿지 않는다.
              등록해 두면 상세가 받은 제스처가 명령으로 바뀌어 여기로 온다(`useMapGestures`).
            */
            setGestureControl(mapRef.current);
          }}
          // 지도 핀도 카드와 같다. 고르고 지도를 맞출 뿐, 상세로 넘어가지는 않는다.
          onPinPress={pressMapPin}
          onMapPress={clearSelection}
          onViewChange={handleViewChange}
        />
      ) : (
        // 좌표를 기다리는 짧은 구간. 지도 배경색 위에 표시만 둬 깜빡임을 줄인다.
        <View pointerEvents="none" style={s.mapPlaceholder}>
          <ActivityIndicator color={colors.limeText} />
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
        {/*
          최대화 단계에서는 시트가 검색바 바로 아래까지 올라와 이 버튼과 겹친다. 그래서 감춘다.

          조건을 그대로 `&&`로 걸면 툭 없어지고 툭 생긴다 — 시트는 스프링으로 부드럽게
          움직이는데 그 위 버튼만 순간이동하면 두 움직임이 따로 노는 것으로 보인다.
          `useFadeToggle`이 사라지는 모션을 다 보여준 뒤에 뗀다(장소 상세도 같은 훅을 쓴다).
        */}
        {locationButton.mounted && (
          <AnimatedPressable
            accessibilityRole="button"
            accessibilityLabel="현재 위치로 돌아가기"
            accessibilityState={{ busy: myLocation.status === 'loading' }}
            disabled={myLocation.status === 'loading'}
            onPress={goToMyLocation}
            style={[s.location, locationButton.style]}
          >
            {/*
              누른 뒤 아무 표시가 없으면 버튼이 고장난 것으로 보인다. 실제로 좌표를 받는 데
              몇 초가 걸릴 수 있어, 기다리는 중임을 반드시 드러낸다.
            */}
            {myLocation.status === 'loading' ? (
              <ActivityIndicator size="small" color={colors.limeText} />
            ) : (
              <Ionicons
                name={myLocation.status === 'granted' ? 'locate' : 'locate-outline'}
                size={23}
                color={myLocation.status === 'denied' ? colors.gray400 : colors.dark}
              />
            )}
          </AnimatedPressable>
        )}

        {/*
          실패 이유. 이게 없으면 권한 거부와 측위 실패가 똑같이 "아무 일도 안 남"으로 보인다.
          버튼이 감춰졌으면 함께 감춘다 — 누를 수 없는 버튼에 대한 안내가 시트 뒤에 남는다.

          **자기 버튼 바로 아래**에 둔다. 사이에 다른 버튼이 끼면 어느 버튼의 안내인지 흐려진다.
        */}
        {locationButton.mounted && myLocation.message && (
          <Text accessibilityRole="alert" style={s.locationMessage}>
            {myLocation.message}
          </Text>
        )}

        {/*
          **옆 장소로 돌려 보는 버튼.** 20m까지 당겨 화면에 여러 장소가 담겼을 때만 나타난다.

          여기서는 상세를 처음 여는 것이라 화면을 쌓는다(`replace` 없이). 상세에서 누를 때는
          갈아 끼운다 — 그쪽 화면이 그렇게 부른다.

          내 위치 버튼과 같은 조건으로 함께 감춘다. 최대화 단계에서는 시트가 그 자리를 덮는다.
        */}
        {nextPlaceButton.mounted && (
          <NextPlaceButton
            onPress={nextPlace.goNext}
            enabled={nextPlace.enabled}
            style={nextPlaceButton.style}
          />
        )}
      </View>

      {/*
        잠깐 뜨는 한 마디. **시트 바로 위에 둔다** — 시트가 어느 단계에 있든 가려지지 않는다
        (`coveredHeight`가 시트가 덮은 높이다).

        `useFadeToggle`로 나타나고 사라진다. 툭 생기고 툭 없어지면 1초짜리 안내가 깜빡임으로
        읽힌다. 손가락은 지도에 그대로 닿아야 하므로 터치를 받지 않는다.
      */}
      {hintToggle.mounted && hint !== null && (
        <Animated.View
          pointerEvents="none"
          style={[s.hint, hintToggle.style, { bottom: coveredHeight + spacing.x4 }]}
        >
          <Text accessibilityRole="alert" style={s.hintText}>
            {hint}
          </Text>
        </Animated.View>
      )}

      {/* 위에 상세가 겹쳐 있으면 감춘다. display로 빼야 레이아웃·그리기까지 건너뛴다. */}
      <Animated.View style={[s.sheet, !onTop && s.sheetHidden, { transform: [{ translateY: sheetY }] }]}>
        {/*
          반투명 표면 한 겹. 농도는 `colors.sheetSurface`가 정하고 장소 상세 시트와 같은 값이다.

          예전에는 이 위에 `BlurView`가 있었다. **안드로이드에서는 흐리게 하지 않고 흰색을
          덧칠할 뿐이다** — `expo-blur`의 기본값이 `experimentalBlurMethod: 'none'`이고, 그때
          `tint="light"`는 `rgba(249,249,249, 255×intensity×0.78)`을 배경색으로 깐다. intensity
          78이면 0.61이라, 표면과 겹쳐 실제 농도가 0.95까지 올라가 거의 흰 종이로 보였다.
        */}
        <View style={s.sheetSurface} />

        <View {...sheet.panHandlers}>
          <Pressable
            accessibilityRole="adjustable"
            accessibilityLabel="장소 목록 높이"
            accessibilityHint="탭하거나 위아래로 끌어 높이를 변경하세요"
            onPress={sheet.cycle}
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
          /*
            **확장 단계에서만 스크롤한다.**

            "보통" 단계에서는 카드를 한 장씩 넘기므로(`CardPager`) 시트까지 함께 스크롤되면
            둘이 같은 세로 제스처를 두고 다툰다. 그 단계 높이는 어차피 카드 한 장에 맞춰
            잡혀 있어 스크롤할 것도 없다.
          */
          scrollEnabled={level === 2}
          contentContainerStyle={[
            s.list,
            /*
              탭바는 이 영역 밖에 있어 마지막 카드를 가리지 않는다. 다만 시트가 화면 밖으로
              내려간 만큼(`sheet.top`)은 더해야 한다 — 그러지 않으면 ScrollView가 화면 밖까지
              자기 영역으로 알아 마지막 카드를 끝까지 끌어올리지 못한다.
            */
            { paddingHorizontal: gutter, paddingBottom: spacing.x6 + sheet.top },
          ]}
        >
          {/*
            "보통" 단계에서는 카드를 한 장씩 넘긴다. 확장하면 목록으로 돌아간다.

            **카드 높이는 `CardPager`가 알려 준다**(`onSlotHeightChange`). 예전에는 첫 카드에
            `onLayout`을 달아 직접 쟀는데, 카드가 넘기는 칸 안에 들어가면 잰 값이 곧 칸 높이가
            되어 둘이 서로 물린다. 재는 일은 칸을 가진 쪽이 맡는 편이 맞다.
          */}
          <CardPager
            paging={level !== 2}
            onSlotHeightChange={setCardHeight}
            activeIndex={selectedCardIndex}
            onIndexChange={selectCardAt}
          >
            {visiblePlaces.map((place) => (
              <Pressable
                key={place.id}
                accessibilityRole="button"
                accessibilityLabel={`${place.name} 지도에서 보기`}
                accessibilityState={{ selected: place.id === selectedPlaceId }}
                onPress={() => focusPlace(place.id)}
                style={[s.placeCard, place.id === selectedPlaceId && s.placeCardSelected]}
              >
                <View style={s.cardTop}>
                  <View style={s.placeCopy}>
                    <Text numberOfLines={1} style={s.placeName}>
                      {place.name}
                    </Text>
                    <Text numberOfLines={1} style={s.address}>
                      {place.address}
                    </Text>
                  </View>
                  {/*
                    상세로 가는 **유일한** 자리다. 카드의 나머지를 누르면 지도만 옮긴다.

                    고른 카드에만 나타난다. 아직 고르지 않은 카드에는 아무 표시도 두지 않는다 —
                    예전에 있던 위치 아이콘과 `지도에서` 글자는 누를 수 있는 것처럼 보이는데
                    실제로는 카드와 같은 동작이라 오해를 샀다.

                    글자 없이 꺽새만 두므로 눌리는 영역이 좁다. hitSlop으로 사방을 넓혀 실제
                    표적은 아이콘보다 훨씬 크게 잡는다.
                  */}
                  {place.id === selectedPlaceId && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${place.name} 상세 보기`}
                      hitSlop={16}
                      onPress={() => openPlace(place.id)}
                      style={s.detailChevron}
                    >
                      <Ionicons name="chevron-forward" size={22} color={colors.dark} />
                    </Pressable>
                  )}
                </View>
                <View style={s.cardRule} />
                {/*
                  올라온 핀 수만 적는다.

                  예전에는 `감지카메라 외 N명`이라고 적었다. `감지카메라`는 **목업의 대표 작성자
                  이름**이고, 목록 응답(`GET /places`)에는 작성자 닉네임이 없다(뷰 각도만 온다).
                  실서버에서는 있지도 않은 사람 이름을 모든 장소에 붙이는 셈이었다.
                */}
                <Text style={s.pinUpload}>지금 핀 {place.pins}개가 올라와 있어요</Text>
                {/*
                  작성자마다 링 모양이 달라야 한다. `ViewAvatar`가 각도별 시안 이미지로 채움
                  비율을 그리므로 90°와 320°가 눈에 띄게 다르게 보인다. 예전에는 어느 장소든
                  같은 다섯 숫자를 단색 테두리에 적어, 링이 아무 정보도 주지 않았다.

                  장소 상세·추천 카드가 쓰는 것과 같은 컴포넌트다.
                */}
                <View style={s.angleRow}>
                  {place.angles.slice(0, ANGLE_PREVIEW_COUNT).map((angle, index) => (
                    <ViewAvatar key={`${place.id}-${index}`} angle={angle} size={ANGLE_RING_SIZE} />
                  ))}
                  {/* 링으로 보여주지 못한 나머지 핀. 다 보여줬으면 적지 않는다. */}
                  {place.pins > ANGLE_PREVIEW_COUNT && (
                    <Text style={s.morePins}>+{place.pins - ANGLE_PREVIEW_COUNT}</Text>
                  )}
                </View>
              </Pressable>
            ))}
          </CardPager>
          {/*
            비어 있는 이유를 구분해서 적는다.

            불러오는 중 · 불러오지 못함 · 이 범위에 없음 · 필터에 걸림이 화면에는 모두 "카드가
            없다"로 똑같이 보인다. 사용자가 할 일이 각각 다르므로(기다린다 / 다시 시도한다 /
            지도를 옮긴다 / 필터를 바꾼다) 문구를 나눈다.
          */}
          {listEmpty && (
            /*
              **높이를 재서 시트에 넘긴다.** 이 블록이 카드 자리를 대신 채우므로 "보통" 단계의
              높이도 이 블록이 정해야 한다. 네 안내의 높이는 `s.empty`가 같게 맞춰 두었으므로
              (`EMPTY_BLOCK_HEIGHT`) 안내가 바뀌어도 시트는 움직이지 않는다.
            */
            <View onLayout={(event) => setEmptyHeight(Math.round(event.nativeEvent.layout.height))}>
              {inView.loading ? (
                <View style={s.empty}>
                  <ActivityIndicator color={colors.limeText} />
                </View>
              ) : inView.error !== null ? (
                <View style={s.empty}>
                  <Text style={s.emptyTitle}>주변 장소를 불러오지 못했어요</Text>
                  <Text style={s.emptyText}>{inView.error}</Text>
                </View>
              ) : inView.places.length === 0 ? (
                <View style={s.empty}>
                  <Text style={s.emptyTitle}>이 근처에는 아직 핀이 없어요</Text>
                  <Text style={s.emptyText}>지도를 옮겨 보거나 첫 핀을 올려보세요.</Text>
                </View>
              ) : (
                <View style={s.empty}>
                  <Text style={s.emptyTitle}>조건에 맞는 장소가 없어요</Text>
                  <Text style={s.emptyText}>다른 혼잡도 필터를 선택해보세요.</Text>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

/**
 * 애니메이션을 얹을 수 있는 누를 것.
 *
 * `Animated.View`로 감싸는 대신 버튼 자체를 움직인다. 감싸면 `alignSelf`·`marginTop` 같은
 * 배치 속성을 감싼 쪽으로 옮겨야 해서 스타일이 두 곳으로 갈린다.
 */
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

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
  /**
   * 잠깐 뜨는 한 마디. 지도 위 안내라 어두운 알약으로 둔다 — 위치 실패 안내와 같은 결이다.
   *
   * 좌우를 0으로 잡고 가운데 정렬해 글자 길이가 달라져도 화면 중앙에 선다. 아래 위치는 시트가
   * 덮은 높이에 맞춰 화면에서 정한다.
   */
  hint: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  hintText: {
    ...type.small,
    paddingVertical: spacing.x2,
    paddingHorizontal: spacing.x4,
    borderRadius: radius.pill,
    overflow: 'hidden',
    color: colors.white,
    backgroundColor: 'rgba(40,38,38,0.86)',
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
    ...glassShadow,
  },
  sheetHidden: { display: 'none' },
  /**
   * 시트의 농도를 정하는 유일한 겹. 값은 장소 상세 시트와 공유한다(`colors.sheetSurface`).
   *
   * 위쪽 모서리를 **스스로도** 둥글게 둔다. 감싼 시트가 `overflow: 'hidden'`으로 잘라 주기는
   * 하지만, 안드로이드에서 그 자르기가 둥근 모서리까지 따라오지 않으면 이 겹이 네모난 모서리로
   * 덮어 버린다. 예전에는 농도가 0.04라 그래도 보이지 않았지만 이제는 그대로 드러난다.
   */
  sheetSurface: {
    ...StyleSheet.absoluteFillObject,
    borderTopLeftRadius: radius.hero,
    borderTopRightRadius: radius.hero,
    backgroundColor: colors.sheetSurface,
  },
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
  /**
   * 현재 위치 줄. 제목 바로 아래에 붙인다.
   *
   * 위로 당기는 이유가 있다. 제목이 든 줄(`sheetHeading`)은 혼잡도 토글의 터치 영역 때문에
   * **44px을 확보**하는데 제목 글줄은 26px뿐이라, 제목 아래에 9px의 빈 칸이 남는다. 여백을
   * 그냥 0으로 두어도 그 9px 때문에 두 줄이 떨어져 보인다. 그만큼을 되돌려 붙인다.
   */
  sheetSubtitle: { ...type.caption, color: colors.gray600, marginTop: -spacing.x1 },
  list: { paddingTop: 0, gap: spacing.x3 },
  /**
   * 장소 카드.
   *
   * 테두리 자리를 **고르지 않았을 때도 미리 비워 둔다**(투명). 고를 때만 테두리를 주면 그
   * 카드가 3px 높아져, 목록이 밀리고 한 장씩 넘기는 칸(`CardPager`)에서는 칸에 갇혀 아래
   * 테두리가 잘린다. 색만 바뀌면 높이가 변하지 않는다.
   */
  placeCard: {
    padding: spacing.x5,
    borderRadius: radius.card,
    borderWidth: 1.5,
    borderColor: 'transparent',
    backgroundColor: 'rgba(255,255,255,0.96)',
    ...glassShadow,
  },
  // 지도에서 보고 있는 장소를 목록에서도 알 수 있게 한다. 핀만 바뀌면 어느 카드였는지 놓친다.
  placeCardSelected: { borderColor: colors.lime },
  // 위로 붙인다. 가운데 정렬이면 꺽새가 이름·영업시간·주소 세 줄의 한가운데로 내려간다.
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.x3 },
  /**
   * 꺽새를 담는 칸.
   *
   * 높이를 장소명 한 줄(`type.title`의 lineHeight 26)과 같게 두고 가운데 정렬해, 꺽새가
   * 이름과 같은 높이에 놓인다. 글꼴 크기 설정이 바뀌어도 두 값이 함께 움직인다.
   *
   * 글자가 없어 눌리는 넓이는 이 칸이 확보하고, 모자란 만큼은 hitSlop으로 넓힌다.
   */
  detailChevron: {
    width: 32,
    height: type.title.lineHeight,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.x2,
  },
  placeCopy: { flex: 1, minWidth: 0 },
  // flex를 주면 안 된다. placeCopy가 세로 방향이라 제목이 남은 높이만큼 늘어나 줄이 어긋난다.
  placeName: { ...type.title, color: colors.dark },
  address: { ...type.caption, color: colors.gray400, marginTop: spacing.x1 },
  cardRule: { width: 64, height: 1, backgroundColor: colors.gray200, marginVertical: spacing.x3 },
  pinUpload: { ...type.caption, color: colors.gray400 },
  angleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.x2, marginTop: spacing.x3 },
  morePins: { ...type.caption, color: colors.gray600, marginLeft: spacing.x1 },
  /**
   * 카드가 없을 때 그 자리를 채우는 안내.
   *
   * **네 안내가 같은 높이여야 한다**(`EMPTY_BLOCK_HEIGHT`). 이 높이가 곧 시트의 "보통" 단계
   * 높이가 되므로, 불러오는 중(표시 하나)과 결과 안내(두 줄)의 높이가 다르면 그 사이에 시트가
   * 한 번 커졌다 작아진다. 최소 높이로 맞추고 가운데 정렬해, 글꼴 설정으로 글줄이 더 커지면
   * 블록이 함께 자라고 그 값이 측정으로 시트에 전해진다.
   */
  empty: {
    minHeight: EMPTY_BLOCK_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.x6,
  },
  emptyTitle: { ...type.title, color: colors.dark },
  emptyText: { ...type.small, color: colors.gray600, marginTop: spacing.x2 },
});
