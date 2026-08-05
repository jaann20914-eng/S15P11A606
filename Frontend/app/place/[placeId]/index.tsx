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
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppTabBar, CARD_SLOT_GAP, useAppTabBarHeight } from '@/components/common';
import { CrowdChart, PLACE_PIN_CARD_HEIGHT, PlaceSearchBar } from '@/components/place';
import { PinCardPager } from '@/features/place-detail/components/PinCardPager';
import { usePinThumbnails } from '@/features/place-detail/hooks/usePinThumbnails';
import { usePlaceDetail } from '@/features/place-detail/hooks/usePlaceDetail';
import { useScreenLayout } from '@/hooks/useResponsivePadding';
import { useCurrentLocation } from '@/hooks/useCurrentLocation';
import { useBottomSheet } from '@/hooks/useBottomSheet';
import { useFadeToggle } from '@/hooks/useFadeToggle';
import { useMapGestures } from '@/hooks/useMapGestures';
import { classifyCrowdFilter } from '@/constants/crowdLevels';
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

/**
 * 카드 한 장이 놓이는 칸의 높이. 재기 전의 어림값이자 **핀이 없을 때 그 자리의 높이**다.
 *
 * 계산으로 나온다 — 카드가 내용과 무관하게 늘 같은 키이기 때문이다(`PLACE_PIN_CARD_HEIGHT`).
 * 예전에는 어림값 240에 핀 없는 경우만 54로 따로 뒀는데, 그러면 **같은 시트가 상태에 따라
 * 오르내린다.** 어느 상태에서도 시트가 제자리에 있도록 한 값으로 모은다(홈도 같은 값을 쓴다).
 */
const PIN_SLOT_HEIGHT = PLACE_PIN_CARD_HEIGHT + CARD_SLOT_GAP;

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
 * 시트 내용의 카드 사이 간격.
 *
 * 스타일(`sheetContent`)과 **접힌 상태를 만드는 계산이 같은 값을 써야 한다** — 혼잡도 카드
 * 높이에 이 값을 더해 아래 구역을 끌어올리므로, 어긋나면 영상핀 카드가 그만큼 밀린다.
 * 그래서 스타일도 이 상수를 쓴다.
 */
const SHEET_CONTENT_GAP = spacing.x6;

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
  const { detail, loading, error, crowdLevel } = usePlaceDetail(
    Number.isInteger(numericPlaceId) ? numericPlaceId : null,
  );
  const place = detail?.place ?? null;
  const pins = detail?.pins ?? [];

  /*
    카드에 그릴 썸네일은 상세 응답으로 끝나지 않는다.

    서버가 목록의 핀에는 S3 객체 키를 담아 주므로 그릴 수 없다. 볼 수 있는 주소는 핀 상세가
    요청 시점에 발급하는 것뿐이라, 이 훅이 카드별로 받아 채운다. 못 받은 카드는 예전처럼
    색 자리로 남는다.

    **지도 쪽은 `pins`를 그대로 쓴다.** 썸네일이 도착하면 이 목록은 새로 만들어지는데, 그것을
    마커·중앙 정렬에 쓰면 그림 하나가 들어올 때마다 마커를 다시 찍고 지도를 다시 옮기게 된다.
    좌표는 두 목록이 같으므로 그릴 것만 이쪽에서 가져간다.
  */
  const cards = usePinThumbnails(detail?.pins);

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
  /** 핀이 없다고 적는 줄의 높이. 그 상태의 "보통" 단계 높이가 된다. */
  const [emptyHeight, setEmptyHeight] = useState(0);

  /**
   * 보여줄 영상핀이 없는 것이 **확실한지.**
   *
   * 조회 중에는 참으로 보지 않는다 — 홈에서 들어온 장소는 활성 핀이 있어서 목록에 있었으므로
   * 카드가 올 가능성이 높다. 그때 빈 높이로 잡아 두면 카드가 도착하며 시트가 한 번 뛴다.
   */
  const noPins = !loading && detail !== null && pins.length === 0;

  const sheet = useBottomSheet({
    space: homeSheetSpace > 0 ? homeSheetSpace : Math.max(0, height - navBarHeight),
    collapsed: headerHeight > 0 ? headerHeight : ESTIMATED_HEADER_HEIGHT,
    /*
      "기본" 단계에서 축소보다 더 보여야 하는 높이 = 카드 한 칸 + 아래 여백.

      카드 한 칸의 높이는 페이저가 알려 준다(`onSlotHeightChange`) — 확장 단계에서는 같은
      자리가 목록이 되어 카드 전부의 높이가 나오므로 화면이 직접 잴 수 없다. 머리글과 카드
      사이 간격은 머리글의 `paddingBottom`이 갖는다(홈과 같다).
    */
    /*
      핀이 없어도 **같은 높이**다. 안내 줄이 카드 한 칸을 그대로 차지한다(`PIN_SLOT_HEIGHT`) —
      상태에 따라 시트가 오르내리지 않는 편이 낫고, 홈도 같은 값으로 맞춰 두었다.
    */
    middleExtra:
      (noPins
        ? emptyHeight > 0
          ? emptyHeight
          : PIN_SLOT_HEIGHT
        : pinSlotHeight > 0
          ? pinSlotHeight
          : PIN_SLOT_HEIGHT) + spacing.x4,
    expandedTop: insets.top + spacing.x3 + layout.searchHeight + spacing.x4,
    /*
      **끌어내려 닫지 않는다.** `onDismiss`를 주지 않으므로 축소가 하한이고, 홈 시트처럼
      그 자리에서 멈춘다.

      예전에는 아래로 밀어 내리면 닫혔다. 시트가 곧 덮개라 "걷어내는" 동작으로 읽힌다고
      보았지만, 팀에서 확인해 보니 **닫는 방법으로 짐작되지 않았다**(2026-08-05). 게다가
      홈 시트는 같은 자리에서 멈추기 때문에, 같은 손짓이 화면에 따라 다르게 동작했다.
      뒤로 가기는 검색바 왼쪽 꺽새가 맡는다(아래 참고).
    */
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

    **한 번 붙이면 자리를 지키고, 움직이는 것은 변형뿐이다.**

    예전에는 이 카드의 높이를 0에서 제 높이까지 늘렸다. 그래야 아래 영상핀 구역이 밀려 내려가는
    것이 부드러웠는데, **높이는 레이아웃 속성이라 네이티브 드라이버로 다룰 수 없다.** 그래서 이
    애니메이션만 JS 스레드에서 돌았고, 시트 스프링은 네이티브에서 돌았다 — 프레임마다 배치를
    다시 계산하는 쪽과 UI 스레드에서 도는 쪽이 어긋나 전환이 끊겨 보였다(2026-08-05).

    지금은 카드를 **늘 제 높이로 흐름에 둔다.** 그래프가 자리를 차지한 만큼(`chartLift`) 아래
    구역을 위로 끌어올려 접힌 상태를 만든다. 펼치면 그 끌어올림을 0으로 되돌리며 카드가 함께
    드러난다. 움직이는 것이 `opacity`와 `translateY`뿐이라 **전부 네이티브 드라이버로 돈다** —
    시트 스프링과 같은 스레드에서 같은 프레임에 그려진다.

    접힌 동안 카드는 화면에서 사라진 것이 아니라 **투명하게 제자리에** 있다. 그 위로 영상핀
    카드가 끌어올려져 덮으므로 보이지 않고, 만지지도 못하게 둔다(`pointerEvents`).
  */
  const chartReveal = useRef(new Animated.Value(0)).current;
  /**
   * 그래프 카드가 차지하는 높이. 재기 전에는 흐름 밖에서 재고, 재고 나면 흐름에 넣는다.
   *
   * **흐름에 든 카드를 그대로 잰다.** 예전에는 늘어나는 상자 안에서 그래프만 재다가 잘린 높이
   * (0)를 받아 그래프가 아예 보이지 않은 적이 있다. 이제 카드가 줄어들지 않으므로 `onLayout`이
   * 언제나 참값을 준다.
   *
   * 재기 전에 흐름에 넣으면 접힌 상태에서 끌어올릴 거리를 몰라 카드가 한 프레임 밀려 보인다.
   * 그래서 첫 렌더에서는 절대 배치로 재고, 값이 오면 자리를 잡는다.
   */
  const [chartHeight, setChartHeight] = useState(0);
  const expanded = level === 2;

  /**
   * 접힌 상태에서 아래 구역을 끌어올릴 거리.
   *
   * 그래프 카드의 높이에 카드 사이 간격(`sheetContent`의 `gap`)을 더한 값이다. 그만큼 올리면
   * 영상핀 카드가 머리글 바로 아래에 붙어, 그래프가 없던 때와 같은 자리에 놓인다.
   */
  const chartLift = chartHeight > 0 ? chartHeight + SHEET_CONTENT_GAP : 0;

  /**
   * 이 화면이 맨 위인지.
   *
   * **위에 다른 화면이 겹치면 시트와 상단 컨트롤을 감춘다.** 이 화면 위에 오는 것들(검색,
   * 영상핀이 없는 장소)도 홈 지도를 비추는 반투명 화면이라, 감추지 않으면 **이 화면의 카드와
   * 그 화면의 카드가 같은 자리에서 겹쳐 보인다**(2026-08-05 QA에서 나왔다). 검색바도 두 겹이
   * 쌓이고, 내 위치 버튼은 위 화면에 없어 그대로 남는다.
   *
   * 홈이 이 화면에 대해 하는 것과 같은 처리다(`app/(tabs)/home/index.tsx`의 `onTop`).
   * **감추기만 하고 언마운트하지 않는다** — 스크롤 위치와 재측정을 잃으면 돌아왔을 때 있던
   * 자리로 정확히 돌아오지 못한다.
   */
  const [onTop, setOnTop] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setOnTop(true);
      return () => setOnTop(false);
    }, []),
  );

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

  /** 시트 안쪽 스크롤. 목록 단계를 벗어날 때 맨 위로 되돌리는 데 쓴다. */
  const listRef = useRef<ScrollView>(null);

  /*
    목록 단계를 벗어나면 알린 스크롤 위치를 버리고, **스크롤 자체도 맨 위로 되돌린다.**

    위치를 남겨 두면 다시 펼치는 순간 그 낡은 값이 적용돼 첫 핀으로 되돌아간다 — 카드를 넘겨
    세 번째 핀을 보다가 시트를 펼치기만 해도 지도가 처음 핀으로 튀는 셈이다.

    스크롤을 되돌리는 것은 다른 문제였다. 목록을 한참 내려 둔 채 시트를 "보통"으로 내리면
    스크롤 위치가 그대로 남아, 한 장만 보여야 하는 칸이 **내려간 만큼 위로 밀려 카드가 탭바에
    잘린 채** 멈췄다. "보통"·"축소" 단계에서 옳은 위치는 맨 위 하나뿐이므로 여기서 못 박는다.
    시트가 동시에 움직이고 있어 되돌리는 것이 따로 보이지 않는다.
  */
  useEffect(() => {
    if (expanded) return;
    setScrollOffset(null);
    listRef.current?.scrollTo({ y: 0, animated: false });
  }, [expanded]);

  /**
   * 이 장소의 마커 색 계열.
   *
   * **상단 혼잡도 토글을 쓰지 않는다.** 지도는 홈 것이라 토글 값을 갖고 있는데, 이 화면의
   * 영상핀은 그 토글로 걸러진 것이 아니다 — 와글 토글을 켜고 검색으로 들어간 여유한 장소의
   * 핀이 전부 자몽색으로 그려졌다(2026-08-05 실기기). 색은 이 장소가 실제로 붐비는 정도가
   * 정해야 한다.
   *
   * 모르면 넘기지 않고 지도의 기본색(라임)에 맡긴다. 근거 없이 자몽색으로 칠하는 것은
   * "여기 붐빈다"는 잘못된 정보라, 모를 때 택할 쪽이 아니다.
   */
  const markerTone = crowdLevel === null ? undefined : (classifyCrowdFilter(crowdLevel) ?? undefined);

  const pinMarkers = useMemo(
    () =>
      pins
        .filter((pin) => pin.latitude !== null && pin.longitude !== null)
        .map((pin) => ({
          id: pin.pinId,
          name: pin.nickname,
          latitude: pin.latitude as number,
          longitude: pin.longitude as number,
          tone: markerTone,
        })),
    [markerTone, pins],
  );

  /** 지금 보고 있는 게시물의 좌표. 없으면 지도를 옮기지 않는다. */
  const focusedPin = pins[pinIndex] ?? null;

  /*
    **맨 위일 때만 올린다.** 위에 다른 화면이 겹쳐 있으면 그 화면이 자기 겹을 올려 둔다 —
    영상핀이 없는 장소 화면은 마커를 하나도 두지 않으려고 빈 겹을 올리는데, 여기서 덮어쓰면
    가려져 있는 이 화면의 마커가 그 위 화면에 그려진다.

    돌아오면 `onTop`이 참으로 바뀌며 이 효과가 다시 돌아 우리 마커를 되돌려 놓는다.
  */
  useEffect(() => {
    if (!onTop || pinMarkers.length === 0) return;

    showPinOverlay({ markers: pinMarkers, selectedPinId: focusedPin?.pinId ?? null });
  }, [focusedPin, onTop, pinMarkers, showPinOverlay]);

  /*
    **지도에서 마커를 누르면 그 게시물 카드로 넘어간다.** 홈에서 장소 마커를 누르면 그 장소
    카드가 골라지는 것과 같은 동작이다.

    눌린 것을 아는 쪽은 홈이다 — 지도가 홈 것이고, 이 화면은 자기 지도가 없어 마커 알림을 받을
    길이 없다. 그래서 홈이 **눌림만 한 번 알리고**(`pressPin`), 여기서 카드를 맞춘 뒤 곧바로
    비운다.

    **위 효과가 쓰는 칸을 함께 쓰지 않는다.** 예전에는 홈이 `pinOverlay.selectedPinId`를 고쳐서
    알렸다. 그 칸은 위 효과가 "보고 있는 카드"를 쓰는 자리라, 두 쪽이 같은 칸을 쓰는 셈이었다.
    저장소 값은 **한 커밋 늦게** 들어오므로 두 값이 어긋난 순간부터 서로 상대의 낡은 값으로
    되돌리기를 주고받았다 — 카드가 두 번호 사이를 튀고 그때마다 지도 이동 요청이 나가
    홈에서 렌더가 끊겼다(2026-08-05 실기기: `1/3`·`2/3`이 수십 번, 겹이 둘일 때는 `1/9`·`7/10`).

    한 번 쓰고 비우는 요청은 그 고리를 만들 수 없다. 비운 뒤에는 되돌릴 값이 남지 않는다.

    **맨 위일 때만 따른다.** 저장소는 겹이 여럿이면 모두가 읽는다. 가려진 겹은 사용자가 보고
    있지 않으므로 카드를 맞출 이유가 없고, 요청을 먼저 비워 버리면 맨 위 화면이 놓친다.
  */
  const pressedPinId = useMapStore((state) => state.pressedPinId);
  const clearPressedPin = useMapStore((state) => state.clearPressedPin);
  useEffect(() => {
    if (!onTop || pressedPinId === null) return;

    const at = pins.findIndex((pin) => pin.pinId === pressedPinId);
    if (at >= 0) setPinIndex(at);
    // 우리 핀이 아니어도 비운다. 남겨 두면 다음 렌더마다 같은 요청을 다시 본다.
    clearPressedPin();
  }, [clearPressedPin, onTop, pins, pressedPinId]);

  /* 상세를 닫으면 홈이 다시 장소 마커를 찍어야 한다. 비우지 않으면 영상핀이 남는다. */
  useEffect(() => clearPinOverlay, [clearPinOverlay]);

  /*
    보고 있는 게시물의 핀을 화면 중앙으로 데려온다.

    20m까지 당긴다 — 한 장소의 핀이 수십 미터 안에 모여 있어 장소용 축척(250m)으로는 여러
    개가 한 점처럼 겹쳐 어느 것이 중앙인지 알 수 없다.

    **지도를 옮기는 것은 맨 위 화면의 일이다.** 지도는 하나뿐인데(홈 것) 이 화면은 여러 겹 떠
    있을 수 있어서, 가려진 겹까지 이동을 요청하면 한 지도를 두 겹이 번갈아 끌어당긴다. 그
    요청이 홈에서 상태 변경으로 바뀌므로(`focus` → `pendingPan`) 겹이 서로를 깨우면 렌더가
    끝나지 않는다 — 위 `markedPinId` 설명에 그 사정을 적어 두었다.

    맨 위로 돌아오면 이 효과가 다시 돌아 보고 있던 카드의 핀으로 지도를 되돌린다. 그 사이 위
    화면이 지도를 옮겨 두었을 수 있으므로 오히려 그래야 맞다.
  */
  useEffect(() => {
    if (!onTop || focusedPin === null) return;

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
  }, [focusOn, focusedPin, onTop, pinIndex, pins.length]);

  useEffect(() => {
    const animation = Animated.timing(chartReveal, {
      toValue: expanded ? 1 : 0,
      duration: expanded ? CHART_REVEAL_MS : CHART_HIDE_MS,
      easing: expanded ? Easing.out(Easing.cubic) : Easing.in(Easing.quad),
      /*
        투명도와 이동뿐이라 UI 스레드에서 돈다. 시트 스프링도 같은 스레드에서 도므로 두 움직임이
        같은 프레임에 그려진다 — 이 값을 켤 수 있게 만든 것이 이번 손질의 목적이다.
      */
      useNativeDriver: true,
    });

    animation.start();

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
        style={[
          s.topControls,
          !onTop && s.covered,
          { top: insets.top + spacing.x3, left: gutter, right: gutter },
        ]}
      >
        {/*
          검색바는 **영상핀이 없는 장소 화면과 같은 것을 쓴다**(`PlaceSearchBar`). 왼쪽이 꺽새로
          뒤로 가고, 검색어 자리에 찾아 들어온 장소 이름이 남는다 — 그 사정은 그 파일에 적어
          두었다. 예전에는 시트를 끌어내려 닫았는데 그 방법이 짐작되지 않았다.

          이름이 아직 오지 않았으면(조회 중·실패) 바가 안내 문구를 대신 놓는다.
        */}
        <PlaceSearchBar keyword={place?.name ?? null} />
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
              <ActivityIndicator size="small" color={colors.limeText} />
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

      {/* 위에 다른 화면이 겹쳐 있으면 감춘다. `display`로 빼야 배치와 그리기까지 건너뛴다. */}
      <Animated.View style={[s.sheet, !onTop && s.covered, { transform: [{ translateY: sheetY }] }]}>
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
                <ActivityIndicator size="small" color={colors.limeText} style={s.headingBusy} />
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
          ref={listRef}
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
            요일별 혼잡도 한 장. **확장 단계에서만 보이고, 머리글 바로 아래 첫 줄에 놓인다.**

            보이지 않는 동안에도 **자리는 그대로 있다.** 아래 구역을 그만큼 끌어올려 없는 것처럼
            둘 뿐이다(`chartLift`) — 그래야 접고 펼치는 동안 배치를 다시 계산하지 않아 시트와 같은
            스레드에서 같은 프레임에 움직인다(위 `chartReveal` 설명 참고).

            시트의 "보통" 단계 높이는 이 카드와 무관하다. 그 높이는 머리글과 영상핀 칸으로만
            정하므로(`middleExtra`), 이 카드가 흐름에 있어도 홈 시트와 같은 높이가 유지된다.

            **장소명·주소·연락처는 넣지 않는다.** 이름과 주소는 이미 머리글에 있어 바로 위에서
            같은 글자를 두 번 읽게 되고, 연락처는 지도 위 시트에서 쓸 일이 없다(카카오 재조회가
            실패하면 빈 문자열로 오기도 한다).

            요일별 혼잡도는 추천 상세와 같은 공용 그래프다(`components/place/CrowdChart`).
            `surface`를 켜지 않는다 — 이 카드 안에 들어가므로 자기 배경을 그리면 카드가 겹친다.
            대신 카드의 안쪽 여백을 그래프가 전제하는 값(`CHART_CARD_PADDING`)으로 맞춰 뒀다.
          */}
          {detail !== null &&
            (chartHeight === 0 ? (
              /*
                높이를 재는 첫 렌더. **흐름 밖에서 잰다.**

                흐름에 넣어 두고 재면 끌어올릴 거리를 모르는 그 프레임에 영상핀 카드가 그래프
                높이만큼 아래로 밀려 보인다. 절대 배치는 자리를 차지하지 않으므로 그 사이에도
                카드가 제자리에 있다. 그리지 않고 누르지도 못하게 둔다.
              */
              <View
                aria-hidden
                pointerEvents="none"
                style={[s.chartCard, s.chartProbe]}
                onLayout={(event) => setChartHeight(Math.round(event.nativeEvent.layout.height))}
              >
                <CrowdChart stats={detail.weeklyCrowdStats} />
              </View>
            ) : (
              <Animated.View
                style={[
                  s.chartCard,
                  {
                    opacity: chartReveal,
                    /* 펼칠 때 위에서 살짝 내려앉는다. 카드가 자라는 것처럼 읽히게 하던 값이다. */
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
                /* 화면 폭이나 글꼴이 바뀌면 높이도 달라진다. 계속 지켜보다 값이 달라지면 갱신한다. */
                onLayout={(event) => setChartHeight(Math.round(event.nativeEvent.layout.height))}
                /* 접힌 동안에는 투명하게 제자리에 있을 뿐이라 손가락이 닿아서는 안 된다. */
                pointerEvents={expanded ? 'auto' : 'none'}
              >
                <CrowdChart stats={detail.weeklyCrowdStats} />
              </Animated.View>
            ))}

          {/*
            영상핀 구역. **접힌 동안 혼잡도 카드가 차지한 만큼 끌어올려 둔다.**

            이동뿐이라 배치는 그대로다 — 목록 단계에서 스크롤 위치로 보고 있는 핀을 정하는 계산
            (`pinListTop`)은 배치 기준이고, 그 단계에서는 끌어올림이 0이라 눈에 보이는 자리와도 같다.
          */}
          <Animated.View
            style={[
              s.pinArea,
              {
                transform: [
                  {
                    translateY: chartReveal.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-chartLift, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            {/*
              영상핀 카드 묶음. 머리글 오른쪽의 `실시간 영상핀`이 이 묶음의 이름표다.

              "보통" 단계는 높이가 **머리글 + 카드 한 장**으로 잡혀 있어 목록을 훑는 자리가
              아니다. 스크롤로 두면 카드가 반쯤 걸친 채 멈춰 어느 쪽도 제대로 보이지 않으므로
              한 장씩 넘긴다. 끝까지 올린 "확장" 단계는 훑는 자리라 목록으로 바뀐다.

              **단계가 바뀌어도 같은 컴포넌트가 그대로 있다.** 예전에는 단계에 따라 페이저와
              목록을 갈아 끼워, 전환하는 그 프레임에 카드가 전부 다시 만들어지면서 움직임이
              끊겼다. 지금은 `paging`만 바뀌므로 카드는 살아 있다.

              **축소 단계에서도 떼어 내지 않는다.** 예전에는 `level > 0`으로 걸러 두었는데, 그러면
              축소에서 올라오는 그 프레임에 칸과 카드가 전부 새로 만들어진다. 칸은 아직 카드를
              재지 못해 어림값(240)을 알리고, 그 값이 곧 시트의 "보통" 높이라 **시트가 어림값
              자리로 갔다가 실제 높이가 도착하면 다시 움직였다** — 카드가 탭바에 잘렸다가 튀어
              올라오는 것으로 보인 것이 이것이다. 홈 시트는 애초에 떼어 내지 않아 이 일이 없었다.
              축소 단계에서는 어차피 화면 밖이라 그려 두어도 보이지 않는다.
            */}
            {pins.length > 0 && (
              /*
                칸이 스크롤 내용 안에서 어디에 있는지 재 둔다. 목록 단계에서 "지금 보고 있는 핀"은
                스크롤 위치로 정하는데, 그 위치는 시트 내용 전체 기준이라 이 칸의 윗변만큼 빼야
                칸 안에서의 위치가 된다. 혼잡도 카드가 그 위에 있으므로 값을 고정할 수 없다.
              */
              <View onLayout={(event) => setPinListTop(event.nativeEvent.layout.y)}>
                <PinCardPager
                  pins={cards}
                  paging={!expanded}
                  onSlotHeightChange={setPinSlotHeight}
                  selectedIndex={pinIndex}
                  onIndexChange={setPinIndex}
                  scrollOffset={scrollOffset === null ? undefined : Math.max(0, scrollOffset - pinListTop)}
                  onSelect={(pin) => router.push(`/pin/${pin.pinId}`)}
                />
              </View>
            )}

            {/*
              핀이 없는 장소도 있다. 비어 있는 이유를 적어야 고장으로 읽히지 않는다.
              카드 묶음과 같은 이유로 단계에 따라 갈아 끼우지 않는다.
            */}
            {noPins && (
              /*
                이 블록이 **카드 한 칸을 그대로 차지한다.** 높이를 재서 시트에 넘기므로 글꼴
                설정으로 글줄이 더 커져도 시트가 따라온다.
              */
              <View
                onLayout={(event) => setEmptyHeight(Math.round(event.nativeEvent.layout.height))}
                style={s.emptyPins}
              >
                <Text style={s.emptyPinsText}>지금 이곳에 올라온 영상핀이 없어요.</Text>
              </View>
            )}
          </Animated.View>
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
  /** 위에 다른 화면이 겹쳤을 때. 두 화면의 카드가 같은 자리에 겹쳐 보이지 않게 한다. */
  covered: { display: 'none' },
  // 검색바 자체의 스타일은 공용 컴포넌트가 갖는다(`components/place/PlaceSearchBar`).
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
   * 주소 줄. **홈의 `현재 위치` 줄과 같은 값이다.**
   *
   * 제목 줄은 글줄(28)보다 넉넉히 44를 확보하므로 그 아래에 16px의 빈 칸이 남는다. 그만큼을
   * 음수 여백으로 되돌려 붙인다 — 홈 시트가 같은 이유로 같은 값을 쓴다.
   *
   * 예전에는 여기만 양수 여백으로 한 칸 띄웠다(장소명이 굵고 커서 뭉쳐 읽힌다고 보았다).
   * 그러면 **머리글 높이가 홈보다 8px 커져 두 시트의 "보통" 단계가 어긋난다** — 같은 자리에
   * 있어야 하는 시트라 그 8px이 눈에 띈다(2026-08-05 실기기).
   */
  headingAddress: { ...type.caption, color: colors.gray400, marginTop: -spacing.x1 },
  // paddingBottom은 바텀바 높이에 맞춰 화면에서 지정한다.
  sheetContent: { gap: SHEET_CONTENT_GAP },
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
   * 높이를 재는 첫 렌더에서만 얹는다. 흐름 밖으로 빼 자리를 차지하지 않게 한다.
   *
   * **카드와 같은 폭이어야 한다.** 좌우를 시트 내용 폭에 맞춰 늘려 두면(`left`·`right` 0) 흐름에
   * 놓였을 때와 같은 폭이 되어, 글줄이 같게 접히고 잰 높이가 그대로 맞는다.
   *
   * 그래프가 늘어나는 창은 이제 없다. 예전에는 높이 0으로 잘린 창 안에 그래프를 두었는데,
   * **RN의 `overflow: hidden`은 좌우까지 함께 자르기 때문에** 그 창이 그래프의 단계 이름을
   * 잘라 먹어(월요일 왼쪽 글자·일요일 오른쪽 글자) 창을 넓히고 안쪽이 되돌리는 겹을 하나 더
   * 두어야 했다. 카드가 줄어들지 않으니 그 겹도, 그 문제도 사라졌다.
   */
  chartProbe: { position: 'absolute', left: 0, right: 0, top: 0, opacity: 0 },
  /**
   * 영상핀 구역. **혼잡도 카드보다 위에 그려야 한다.**
   *
   * 접힌 상태에서는 이 구역이 그 카드 자리로 끌어올려져 겹친다. 위에 있어야 영상핀 카드가
   * 그래프를 덮으며 올라오고, 아래에 있으면 반투명하게 흐려지는 그래프에 가려 보인다.
   *
   * 안드로이드는 형제 순서보다 `elevation`을 먼저 본다 — 그래프 카드가 그림자 때문에 4를 갖고
   * 있어, 순서만으로는 그쪽이 위로 올라간다. `zIndex`는 iOS·웹 몫이다. 배경색이 없으므로 이
   * 값으로 그림자가 생기지는 않는다.
   */
  pinArea: { zIndex: 1, elevation: 5 },
  /** 핀이 없을 때 카드 자리를 대신 채우는 블록. 카드 한 칸과 같은 높이로 잡아 시트가 제자리에 있게 한다. */
  emptyPins: { minHeight: PIN_SLOT_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  emptyPinsText: { ...type.small, color: colors.gray400 },
});
